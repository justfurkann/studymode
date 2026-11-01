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

-- Aşama 27-28: who the students are (user_metadata.education: level, school, department, year, and the
-- optional birth year, gender, "heard from"), for the admin page. A separate function so admin_users
-- keeps its shape; the app works without this one too. Dropped first because its columns grew.
drop function if exists public.admin_schools();
create or replace function public.admin_schools()
returns table (id uuid, level text, school text, department text, class_year text, birth_year integer, gender text, heard_from text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select u.id,
         (u.raw_user_meta_data -> 'education' ->> 'level')::text,
         (u.raw_user_meta_data -> 'education' ->> 'school')::text,
         (u.raw_user_meta_data -> 'education' ->> 'department')::text,
         (u.raw_user_meta_data -> 'education' ->> 'classYear')::text,
         case when (u.raw_user_meta_data -> 'education' ->> 'birthYear') ~ '^[0-9]{4}$' then (u.raw_user_meta_data -> 'education' ->> 'birthYear')::integer end,
         (u.raw_user_meta_data -> 'education' ->> 'gender')::text,
         (u.raw_user_meta_data -> 'education' ->> 'heardFrom')::text
  from auth.users u
  where u.raw_user_meta_data ? 'education';
end $$;
revoke all on function public.admin_schools() from public, anon;
grant execute on function public.admin_schools() to authenticated;

-- Aşama 31: Premium codes (sold through Shopier, or given away for campaigns).
-- A code adds days of Premium to the account that redeems it. Codes are stored only as a SHA-256
-- hash; the plain code is shown once, to the admin who creates it. A paid Premium account counts as
-- VIP for limits (Free+, Premium features, daily AI), but its role stays as it is (no VIP badge).
-- Safe to run again (if not exists / create or replace). Kept in schema.sql too.

create table if not exists public.premium_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  until timestamptz not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.premium_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  -- Last four characters, to tell codes apart in the admin list without revealing them.
  hint text not null,
  days integer not null check (days between 1 and 400),
  label text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  redeemed_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz,
  revoked_at timestamptz
);
create table if not exists public.premium_redeem_failures (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  at timestamptz not null default now()
);
create index if not exists premium_redeem_failures_user_at on public.premium_redeem_failures (user_id, at);

alter table public.premium_access enable row level security;
alter table public.premium_codes enable row level security;
alter table public.premium_redeem_failures enable row level security;
drop policy if exists "read own premium" on public.premium_access;
create policy "read own premium" on public.premium_access for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete on public.premium_access from anon, authenticated;
grant select on public.premium_access to authenticated;
revoke all on public.premium_codes, public.premium_redeem_failures from anon, authenticated;

-- The role that sets the limits: VIP/admin as given; otherwise VIP while paid Premium lasts.
create or replace function public.limit_role(uid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select r.role from public.user_roles r where r.user_id = uid),
    case when exists (select 1 from public.premium_access p where p.user_id = uid and p.until > now()) then 'vip' end,
    'normal'
  )
$$;

create or replace function public.premium_until_of(uid uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select p.until from public.premium_access p where p.user_id = uid and p.until > now()
$$;

-- The caller's quota status: role (as given), used today, limit, allowed, and paid Premium's end.
create or replace function public.ai_quota() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'role', coalesce(r.role, 'normal'),
    'used', coalesce(u.count, 0),
    'limit', public.ai_limit_for(public.limit_role(me.id)),
    'allowed', public.ai_limit_for(public.limit_role(me.id)) is null or coalesce(u.count, 0) < public.ai_limit_for(public.limit_role(me.id)),
    'premium_until', public.premium_until_of(me.id)
  )
  from (select (select auth.uid()) as id) me
  left join public.user_roles r on r.user_id = me.id
  left join public.ai_usage u on u.user_id = me.id and u.day = public.istanbul_today()
  where me.id is not null
$$;

create or replace function public.plus_quota() returns json
language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'role', coalesce(r.role, 'normal'),
    'eligible', public.plus_limit_for(public.limit_role(me.id)) > 0,
    'used', coalesce(u.plus_count, 0),
    'limit', public.plus_limit_for(public.limit_role(me.id)),
    'site_used', coalesce(d.count, 0),
    'site_limit', public.plus_site_limit(),
    'allowed', coalesce(u.plus_count, 0) < public.plus_limit_for(public.limit_role(me.id)) and coalesce(d.count, 0) < public.plus_site_limit(),
    'premium_until', public.premium_until_of(me.id)
  )
  from (select (select auth.uid()) as id) me
  left join public.user_roles r on r.user_id = me.id
  left join public.ai_usage u on u.user_id = me.id and u.day = public.istanbul_today()
  left join public.ai_plus_daily d on d.day = public.istanbul_today()
  where me.id is not null
$$;

create or replace function public.consume_plus() returns json
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return null; end if;
  if public.plus_limit_for(public.limit_role(auth.uid())) = 0 then return public.plus_quota(); end if;
  insert into public.ai_usage (user_id, day, count, plus_count) values (auth.uid(), public.istanbul_today(), 0, 1)
  on conflict (user_id, day) do update set plus_count = public.ai_usage.plus_count + 1;
  insert into public.ai_plus_daily (day, count) values (public.istanbul_today(), 1)
  on conflict (day) do update set count = public.ai_plus_daily.count + 1;
  return public.plus_quota();
end $$;

-- "SM-7KQ2-X9PD-4M8T", "sm7kq2x9pd4m8t" and "7KQ2 X9PD 4M8T" are the same code.
create or replace function public.premium_code_hash(code text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  norm text := upper(regexp_replace(coalesce(code, ''), '[^A-Za-z0-9]', '', 'g'));
begin
  if length(norm) = 12 then norm := 'SM' || norm; end if;
  return encode(extensions.digest(norm, 'sha256'), 'hex');
end $$;

-- Redeem a code for the signed-in user. Returns { ok, error?, days?, premium_until? }; never raises
-- for a wrong code, so failed attempts are recorded and limited (10 an hour).
create or replace function public.redeem_code(code text) returns json
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  c public.premium_codes%rowtype;
  new_until timestamptz;
begin
  if me is null then return json_build_object('ok', false, 'error', 'not_signed_in'); end if;
  delete from public.premium_redeem_failures where user_id = me and at < now() - interval '1 day';
  if (select count(*) from public.premium_redeem_failures where user_id = me and at > now() - interval '1 hour') >= 10 then
    return json_build_object('ok', false, 'error', 'too_many');
  end if;

  select * into c from public.premium_codes where code_hash = public.premium_code_hash(code) for update;
  if not found or c.revoked_at is not null then
    insert into public.premium_redeem_failures (user_id) values (me);
    return json_build_object('ok', false, 'error', 'invalid');
  end if;
  if c.redeemed_by is not null then
    if c.redeemed_by <> me then insert into public.premium_redeem_failures (user_id) values (me); end if;
    return json_build_object('ok', false, 'error', case when c.redeemed_by = me then 'already_yours' else 'used' end);
  end if;

  update public.premium_codes set redeemed_by = me, redeemed_at = now() where id = c.id;
  insert into public.premium_access (user_id, until) values (me, now() + make_interval(days => c.days))
  on conflict (user_id) do update
    set until = greatest(public.premium_access.until, now()) + make_interval(days => c.days), updated_at = now()
  returning until into new_until;
  return json_build_object('ok', true, 'days', c.days, 'premium_until', new_until);
end $$;

-- Admin: make codes. Returns the plain codes once; only their hashes are kept.
create or replace function public.admin_create_codes(how_many integer, days integer, label text default null)
returns table (code text, hint text)
language plpgsql volatile security definer set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  raw bytea;
  body text;
  plain text;
  i integer;
  made integer := 0;
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  if how_many is null or how_many < 1 or how_many > 200 then raise exception 'how_many must be 1-200' using errcode = '22023'; end if;
  if days is null or days < 1 or days > 400 then raise exception 'days must be 1-400' using errcode = '22023'; end if;
  while made < how_many loop
    raw := extensions.gen_random_bytes(12);
    body := '';
    -- 32 letters: each random byte picks one evenly (256 is a multiple of 32).
    for i in 0..11 loop
      body := body || substr(alphabet, (get_byte(raw, i) % 32) + 1, 1);
    end loop;
    plain := 'SM-' || substr(body, 1, 4) || '-' || substr(body, 5, 4) || '-' || substr(body, 9, 4);
    begin
      insert into public.premium_codes (code_hash, hint, days, label, created_by)
      values (public.premium_code_hash(plain), right(body, 4), admin_create_codes.days, nullif(trim(admin_create_codes.label), ''), auth.uid());
      code := plain;
      hint := right(body, 4);
      made := made + 1;
      return next;
    exception when unique_violation then
      -- Astronomically unlikely; just draw again.
    end;
  end loop;
end $$;

-- Admin: the latest codes (never the codes themselves) and who used them.
create or replace function public.admin_codes()
returns table (id uuid, hint text, days integer, label text, created_at timestamptz, redeemed_at timestamptz, redeemed_email text, revoked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select c.id, c.hint, c.days, c.label, c.created_at, c.redeemed_at, u.email::text, c.revoked_at
  from public.premium_codes c left join auth.users u on u.id = c.redeemed_by
  order by c.created_at desc
  limit 500;
end $$;

-- Admin: cancel a code that has not been used (e.g. a refund).
create or replace function public.admin_revoke_code(code_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.premium_codes set revoked_at = now() where id = code_id and redeemed_at is null and revoked_at is null;
  if not found then raise exception 'already used or revoked' using errcode = '22023'; end if;
end $$;

-- Admin: who has paid Premium and until when.
create or replace function public.admin_premium()
returns table (id uuid, email text, until timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return query
  select p.user_id, u.email::text, p.until from public.premium_access p join auth.users u on u.id = p.user_id order by p.until desc;
end $$;

revoke all on function public.limit_role(uuid), public.premium_until_of(uuid), public.premium_code_hash(text) from public, anon, authenticated;
revoke all on function public.ai_quota(), public.plus_quota(), public.consume_plus(), public.redeem_code(text),
  public.admin_create_codes(integer, integer, text), public.admin_codes(), public.admin_revoke_code(uuid), public.admin_premium() from public, anon;
grant execute on function public.ai_quota(), public.plus_quota(), public.consume_plus(), public.redeem_code(text),
  public.admin_create_codes(integer, integer, text), public.admin_codes(), public.admin_revoke_code(uuid), public.admin_premium() to authenticated;
