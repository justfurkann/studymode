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

-- Roles, daily AI quota and the founder's admin tools (Aşama 11).
-- user_roles: only an admin (or SQL in the dashboard) can give a role; users can only read their own.
-- ai_usage: the shared free AI counts requests per user per Istanbul day; users can read theirs,
-- only the server's functions below write it.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('vip', 'admin')),
  granted_at timestamptz not null default now()
);
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, day)
);
alter table public.user_roles enable row level security;
alter table public.ai_usage enable row level security;
drop policy if exists "read own role" on public.user_roles;
create policy "read own role" on public.user_roles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "read own usage" on public.ai_usage;
create policy "read own usage" on public.ai_usage for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.user_roles, public.ai_usage from anon, authenticated;

create or replace function public.istanbul_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Europe/Istanbul')::date $$;

-- Daily limits per role; null = no limit. Change the numbers here to adjust.
create or replace function public.ai_limit_for(r text) returns integer
language sql immutable set search_path = '' as $$
  select case r when 'admin' then null when 'vip' then 150 else 40 end
$$;

-- The caller's quota status: role, used today, limit, allowed.
create or replace function public.ai_quota() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'role', coalesce(r.role, 'normal'),
    'used', coalesce(u.count, 0),
    'limit', public.ai_limit_for(coalesce(r.role, 'normal')),
    'allowed', public.ai_limit_for(coalesce(r.role, 'normal')) is null or coalesce(u.count, 0) < public.ai_limit_for(coalesce(r.role, 'normal'))
  )
  from (select (select auth.uid()) as id) me
  left join public.user_roles r on r.user_id = me.id
  left join public.ai_usage u on u.user_id = me.id and u.day = public.istanbul_today()
  where me.id is not null
$$;

-- Counts one successful AI request for the caller. Only ever adds one.
create or replace function public.consume_ai() returns json
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return null; end if;
  insert into public.ai_usage (user_id, day, count) values (auth.uid(), public.istanbul_today(), 1)
  on conflict (user_id, day) do update set count = public.ai_usage.count + 1;
  return public.ai_quota();
end $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'admin')
$$;

-- Admin: every account with its role and activity (no note contents).
drop function if exists public.admin_users();
create or replace function public.admin_users()
returns table (id uuid, email text, name text, created_at timestamptz, last_sign_in_at timestamptz, role text, ai_today integer, notes bigint, last_study text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select u.id, u.email::text, coalesce(u.raw_user_meta_data ->> 'full_name', '')::text, u.created_at, u.last_sign_in_at,
         coalesce(r.role, 'normal')::text,
         coalesce((select a.count from public.ai_usage a where a.user_id = u.id and a.day = public.istanbul_today()), 0)::integer,
         (select count(*) from public.notes n where n.user_id = u.id),
         (select max(s.day)::text from public.study_days s where s.user_id = u.id)
  from auth.users u left join public.user_roles r on r.user_id = u.id
  order by u.created_at desc;
end $$;

-- Admin: give or take a role ('normal' removes it). An admin cannot demote themselves by accident.
create or replace function public.admin_set_role(target uuid, new_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if new_role not in ('normal', 'vip', 'admin') then raise exception 'bad role' using errcode = '22023'; end if;
  if target = auth.uid() and new_role <> 'admin' then raise exception 'cannot demote yourself' using errcode = '22023'; end if;
  if new_role = 'normal' then delete from public.user_roles where user_id = target;
  else insert into public.user_roles (user_id, role) values (target, new_role) on conflict (user_id) do update set role = excluded.role, granted_at = now();
  end if;
end $$;

-- Admin: the latest feedback and browser errors.
create or replace function public.admin_feedback()
returns table (kind text, message text, contact text, page text, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select f.kind, f.message, f.contact, f.page, u.email::text, f.created_at
  from public.feedback f left join auth.users u on u.id = f.user_id order by f.created_at desc limit 100;
end $$;

create or replace function public.admin_errors()
returns table (message text, page text, times bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query select e.message, e.page, count(*), max(e.created_at)
  from public.client_errors e where e.created_at > now() - interval '30 days'
  group by e.message, e.page order by max(e.created_at) desc limit 50;
end $$;

revoke all on function public.ai_quota(), public.consume_ai(), public.is_admin(), public.admin_users(),
  public.admin_set_role(uuid, text), public.admin_feedback(), public.admin_errors() from public, anon;
grant execute on function public.ai_quota(), public.consume_ai(), public.is_admin(), public.admin_users(),
  public.admin_set_role(uuid, text), public.admin_feedback(), public.admin_errors() to authenticated;

-- Free+ (Aşama 12): VIPs and admins may use a stronger Gemini on Vertex AI, paid from Google Cloud
-- trial credit. Hard caps here, on top of Google's own: per person per day by role, and for the
-- whole site per day. When a cap is reached the server quietly uses the normal free AI instead.
alter table public.ai_usage add column if not exists plus_count integer not null default 0 check (plus_count >= 0);
create table if not exists public.ai_plus_daily (
  day date primary key,
  count integer not null default 0 check (count >= 0)
);
alter table public.ai_plus_daily enable row level security;
revoke all on public.ai_plus_daily from anon, authenticated;

-- Change the numbers here to adjust. 0 = not allowed.
create or replace function public.plus_limit_for(r text) returns integer
language sql immutable set search_path = '' as $$
  select case r when 'admin' then 100 when 'vip' then 30 else 0 end
$$;
create or replace function public.plus_site_limit() returns integer
language sql immutable set search_path = '' as $$ select 300 $$;

create or replace function public.plus_quota() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'role', coalesce(r.role, 'normal'),
    'eligible', public.plus_limit_for(coalesce(r.role, 'normal')) > 0,
    'used', coalesce(u.plus_count, 0),
    'limit', public.plus_limit_for(coalesce(r.role, 'normal')),
    'site_used', coalesce(d.count, 0),
    'site_limit', public.plus_site_limit(),
    'allowed', coalesce(u.plus_count, 0) < public.plus_limit_for(coalesce(r.role, 'normal')) and coalesce(d.count, 0) < public.plus_site_limit()
  )
  from (select (select auth.uid()) as id) me
  left join public.user_roles r on r.user_id = me.id
  left join public.ai_usage u on u.user_id = me.id and u.day = public.istanbul_today()
  left join public.ai_plus_daily d on d.day = public.istanbul_today()
  where me.id is not null
$$;

-- Counts one successful Free+ answer for the caller and for the site. Only for eligible roles.
create or replace function public.consume_plus() returns json
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return null; end if;
  if public.plus_limit_for(coalesce((select role from public.user_roles where user_id = auth.uid()), 'normal')) = 0 then return public.plus_quota(); end if;
  insert into public.ai_usage (user_id, day, count, plus_count) values (auth.uid(), public.istanbul_today(), 0, 1)
  on conflict (user_id, day) do update set plus_count = public.ai_usage.plus_count + 1;
  insert into public.ai_plus_daily (day, count) values (public.istanbul_today(), 1)
  on conflict (day) do update set count = public.ai_plus_daily.count + 1;
  return public.plus_quota();
end $$;

revoke all on function public.plus_quota(), public.consume_plus() from public, anon;
grant execute on function public.plus_quota(), public.consume_plus() to authenticated;
