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

create index if not exists notes_user_idx on public.notes (user_id);
create index if not exists cards_user_due_idx on public.cards (user_id, due);
create index if not exists attempts_user_idx on public.quiz_attempts (user_id);
create index if not exists exams_user_idx on public.exam_results (user_id);

alter table public.courses enable row level security;
alter table public.notes enable row level security;
alter table public.cards enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.exam_results enable row level security;

do $$
declare t text;
begin
  foreach t in array array['courses', 'notes', 'cards', 'quiz_attempts', 'exam_results'] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)',
      t
    );
  end loop;
end $$;
