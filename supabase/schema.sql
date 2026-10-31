-- studymode veritabanı şeması.
-- Supabase panelinde SQL Editor'e yapıştırıp bir kez çalıştır.
-- Her tabloda Row Level Security açık: herkes yalnızca kendi satırlarını görebilir ve değiştirebilir.

create table if not exists public.courses (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  color text not null,
  exam_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notes (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  content text not null check (char_length(content) <= 400000),
  summary jsonb,
  questions jsonb not null default '[]'::jsonb,
  practice jsonb not null default '[]'::jsonb,
  generator text check (generator in ('ai', 'local')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cards (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  note_id uuid references public.notes (id) on delete cascade,
  front text not null,
  back text not null,
  source text,
  due timestamptz not null default now(),
  "interval" real not null default 0,
  ease real not null default 2.5,
  reps integer not null default 0,
  lapses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  score integer not null check (score >= 0),
  total integer not null check (total > 0 and score <= total),
  wrong_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Finished mock exams (added later; safe to run again on an existing database).
create table if not exists public.exam_results (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  format text not null check (format in ('test', 'classic', 'mixed')),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  source text not null check (source in ('ai', 'local')),
  note_ids jsonb not null default '[]'::jsonb,
  questions jsonb not null,
  answers jsonb not null,
  scores jsonb not null,
  feedback jsonb not null default '[]'::jsonb,
  score real not null check (score >= 0),
  total integer not null check (total > 0),
  duration_seconds integer,
  created_at timestamptz not null default now()
);

-- Daily study activity for streaks and daily goals (added later; safe to run again on an existing database).
create table if not exists public.study_days (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day text not null check (day ~ '^\d{4}-\d{2}-\d{2}$'),
  reviews integer not null default 0 check (reviews >= 0),
  quizzes integer not null default 0 check (quizzes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Several exams per course (vize, final, bütünleme…). courses.exam_date is kept and follows the
-- nearest upcoming exam, so older data stays valid.
create table if not exists public.course_exams (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  kind text not null check (kind in ('vize', 'final', 'butunleme', 'quiz', 'diger')),
  title text check (title is null or char_length(title) <= 80),
  "date" date not null,
  weight real check (weight is null or (weight >= 0 and weight <= 100)),
  note_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Options chosen in a note's test, so the last result can be shown again later.
alter table public.quiz_attempts add column if not exists answers jsonb;

-- Other study work (written answers, explanations) that keeps the streak alive.
alter table public.study_days add column if not exists actions integer not null default 0;

create index if not exists notes_user_idx on public.notes (user_id);
create index if not exists cards_user_due_idx on public.cards (user_id, due);
create index if not exists attempts_user_idx on public.quiz_attempts (user_id);
create index if not exists exams_user_idx on public.exam_results (user_id);
create index if not exists course_exams_user_idx on public.course_exams (user_id, course_id);
create index if not exists study_days_user_idx on public.study_days (user_id, day);

alter table public.courses enable row level security;
alter table public.notes enable row level security;
alter table public.cards enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.exam_results enable row level security;
alter table public.study_days enable row level security;
alter table public.course_exams enable row level security;

do $$
declare t text;
begin
  foreach t in array array['courses', 'notes', 'cards', 'quiz_attempts', 'exam_results', 'study_days', 'course_exams'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end $$;

-- Shared courses: a snapshot of one course behind an unguessable link (Aşama 9).
-- Owners manage their own rows; nobody can list shares. A friend reads one only by its exact
-- token, through get_course_share below.
create table if not exists public.course_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  token text not null unique check (token ~ '^[A-Za-z0-9]{16,64}$'),
  title text not null check (char_length(title) between 1 and 120),
  owner_name text check (owner_name is null or char_length(owner_name) <= 80),
  snapshot jsonb not null check (octet_length(snapshot::text) <= 3000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists course_shares_user_idx on public.course_shares (user_id, course_id);
alter table public.course_shares enable row level security;
drop policy if exists "own rows" on public.course_shares;
create policy "own rows" on public.course_shares for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create or replace function public.get_course_share(share_token text)
returns table (title text, owner_name text, snapshot jsonb, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select s.title, s.owner_name, s.snapshot, s.updated_at
  from public.course_shares s
  where s.token = share_token
  limit 1;
$$;
revoke all on function public.get_course_share(text) from public;
grant execute on function public.get_course_share(text) to anon, authenticated;

-- Feedback and client errors (Aşama 10). Anyone using the app (signed in or not) may add a row;
-- nobody can read, change or delete rows through the API. The owner reads them in Supabase.
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null check (kind in ('fikir', 'hata', 'diger')),
  message text not null check (char_length(message) between 3 and 2000),
  contact text check (contact is null or char_length(contact) <= 120),
  page text check (page is null or char_length(page) <= 200),
  device text check (device is null or char_length(device) <= 300),
  created_at timestamptz not null default now()
);
create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  message text not null check (char_length(message) between 1 and 500),
  stack text check (stack is null or char_length(stack) <= 4000),
  page text check (page is null or char_length(page) <= 200),
  device text check (device is null or char_length(device) <= 300),
  release text check (release is null or char_length(release) <= 40),
  created_at timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists client_errors_created_idx on public.client_errors (created_at desc);
alter table public.feedback enable row level security;
alter table public.client_errors enable row level security;
drop policy if exists "anyone can send" on public.feedback;
create policy "anyone can send" on public.feedback for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
drop policy if exists "anyone can report" on public.client_errors;
create policy "anyone can report" on public.client_errors for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
grant insert on public.feedback, public.client_errors to anon, authenticated;
