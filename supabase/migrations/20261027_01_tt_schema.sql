-- Performa training tests: pre-test, post-test and evaluation form.
-- All data lives in schema "tt", which is NOT exposed through the Supabase API.
-- The browser only talks to the tt_* functions in "public" (security definer),
-- so the answer key never leaves the database.

create schema if not exists tt;
revoke all on schema tt from public, anon, authenticated;

-- One row per training session (one client, one training date).
create table tt.sessions (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9-]{3,60}$'),
  title       text not null,
  client      text not null,
  trainer     text,
  held_on     date,
  pre_open    boolean not null default true,
  post_open   boolean not null default false,
  eval_open   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Multiple-choice questions for the pre-test and the post-test (answer key included).
create table tt.questions (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references tt.sessions(id) on delete cascade,
  form        text not null check (form in ('pre', 'post')),
  no          int  not null check (no between 1 and 100),
  topic       text not null,
  body        text not null,
  options     jsonb not null,
  correct     text not null check (correct in ('A', 'B', 'C', 'D')),
  slide_ref   text,
  unique (session_id, form, no)
);

-- Items of the evaluation form: 1-5 scale, 0-10 recommendation score, or free text.
create table tt.eval_items (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references tt.sessions(id) on delete cascade,
  no          int  not null check (no between 1 and 100),
  section     text not null,
  kind        text not null check (kind in ('scale', 'nps', 'text')),
  body        text not null,
  required    boolean not null default true,
  unique (session_id, no)
);

create table tt.test_submissions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references tt.sessions(id) on delete cascade,
  form          text not null check (form in ('pre', 'post')),
  name          text not null,
  name_norm     text not null,
  unit          text,
  answers       jsonb not null,
  score         int  not null,
  total         int  not null,
  duration_s    int,
  submitted_at  timestamptz not null default now(),
  unique (session_id, form, name_norm)
);
create index test_submissions_session_form_idx on tt.test_submissions (session_id, form);

create table tt.eval_submissions (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references tt.sessions(id) on delete cascade,
  name          text,
  unit          text,
  responses     jsonb not null,
  submitted_at  timestamptz not null default now()
);
create index eval_submissions_session_idx on tt.eval_submissions (session_id);

-- Single-row admin passcode (bcrypt hash). Set separately, never committed.
create table tt.admin_config (
  id             int primary key check (id = 1),
  passcode_hash  text not null
);

-- Lock every table: RLS on, no policies, no grants for API roles.
alter table tt.sessions          enable row level security;
alter table tt.questions         enable row level security;
alter table tt.eval_items        enable row level security;
alter table tt.test_submissions  enable row level security;
alter table tt.eval_submissions  enable row level security;
alter table tt.admin_config      enable row level security;
revoke all on all tables in schema tt from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin passcode check (not callable from the API: schema tt is not exposed)
-- ---------------------------------------------------------------------------
create or replace function tt.admin_check(p_pass text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  h text;
begin
  select passcode_hash into h from tt.admin_config where id = 1;
  if h is null or p_pass is null or extensions.crypt(p_pass, h) <> h then
    perform pg_sleep(1);  -- slows down guessing
    raise exception 'tt:auth';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Participant-facing functions
-- ---------------------------------------------------------------------------
create or replace function public.tt_get_session(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s tt.sessions;
begin
  select * into s from tt.sessions where slug = lower(btrim(p_slug));
  if not found then raise exception 'tt:notfound'; end if;
  return jsonb_build_object(
    'slug', s.slug, 'title', s.title, 'client', s.client, 'trainer', s.trainer,
    'held_on', s.held_on, 'pre_open', s.pre_open, 'post_open', s.post_open, 'eval_open', s.eval_open
  );
end;
$$;

-- Returns the questions (without the answer key) or the evaluation items, only while the form is open.
create or replace function public.tt_get_form(p_slug text, p_form text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s tt.sessions;
  v_open boolean;
  v_items jsonb := '[]'::jsonb;
begin
  select * into s from tt.sessions where slug = lower(btrim(p_slug));
  if not found then raise exception 'tt:notfound'; end if;
  if p_form not in ('pre', 'post', 'eval') then raise exception 'tt:invalid'; end if;

  v_open := case p_form when 'pre' then s.pre_open when 'post' then s.post_open else s.eval_open end;

  if v_open then
    if p_form = 'eval' then
      select coalesce(jsonb_agg(jsonb_build_object(
               'no', e.no, 'section', e.section, 'kind', e.kind, 'body', e.body, 'required', e.required
             ) order by e.no), '[]'::jsonb)
        into v_items
        from tt.eval_items e where e.session_id = s.id;
    else
      select coalesce(jsonb_agg(jsonb_build_object(
               'no', q.no, 'body', q.body, 'options', q.options
             ) order by q.no), '[]'::jsonb)
        into v_items
        from tt.questions q where q.session_id = s.id and q.form = p_form;
    end if;
  end if;

  return jsonb_build_object('title', s.title, 'client', s.client, 'open', v_open, 'items', v_items);
end;
$$;

-- Scores the pre-test or post-test on the server and stores it.
create or replace function public.tt_submit_test(
  p_slug text, p_form text, p_name text, p_unit text, p_answers jsonb, p_duration int default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s tt.sessions;
  v_open boolean;
  v_name text;
  v_unit text;
  v_norm text;
  v_total int;
  v_valid int;
  v_score int;
  v_pre int;
  v_clean jsonb;
begin
  select * into s from tt.sessions where slug = lower(btrim(p_slug));
  if not found then raise exception 'tt:notfound'; end if;
  if p_form not in ('pre', 'post') then raise exception 'tt:invalid'; end if;

  v_open := case p_form when 'pre' then s.pre_open else s.post_open end;
  if not v_open then raise exception 'tt:closed'; end if;

  v_name := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_unit := nullif(regexp_replace(btrim(coalesce(p_unit, '')), '\s+', ' ', 'g'), '');
  if char_length(v_name) < 2 or char_length(v_name) > 100 or char_length(coalesce(v_unit, '')) > 100 then
    raise exception 'tt:invalid';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then raise exception 'tt:invalid'; end if;
  v_norm := lower(v_name);

  select count(*) into v_total from tt.questions where session_id = s.id and form = p_form;
  select count(*) into v_valid from tt.questions q
    where q.session_id = s.id and q.form = p_form and (p_answers ->> (q.no)::text) in ('A', 'B', 'C', 'D');
  if v_total = 0 or v_valid <> v_total then raise exception 'tt:incomplete'; end if;

  if (select count(*) from tt.test_submissions where session_id = s.id and form = p_form) >= 500 then
    raise exception 'tt:full';
  end if;

  select count(*) into v_score from tt.questions q
    where q.session_id = s.id and q.form = p_form and (p_answers ->> (q.no)::text) = q.correct;
  select jsonb_object_agg((q.no)::text, p_answers ->> (q.no)::text) into v_clean
    from tt.questions q where q.session_id = s.id and q.form = p_form;

  begin
    insert into tt.test_submissions (session_id, form, name, name_norm, unit, answers, score, total, duration_s)
    values (s.id, p_form, v_name, v_norm, v_unit, v_clean, v_score, v_total,
            case when p_duration between 0 and 86400 then p_duration end);
  exception when unique_violation then
    raise exception 'tt:duplicate';
  end;

  if p_form = 'post' then
    select t.score into v_pre from tt.test_submissions t
      where t.session_id = s.id and t.form = 'pre' and t.name_norm = v_norm;
  end if;

  return jsonb_build_object('score', v_score, 'total', v_total, 'pre_score', v_pre);
end;
$$;

-- Validates and stores the evaluation form. Name and unit are optional (anonymous allowed).
create or replace function public.tt_submit_eval(p_slug text, p_name text, p_unit text, p_responses jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s tt.sessions;
  r tt.eval_items;
  v jsonb;
  n numeric;
  lo int;
  hi int;
  t text;
  v_name text;
  v_unit text;
  v_clean jsonb := '{}'::jsonb;
begin
  select * into s from tt.sessions where slug = lower(btrim(p_slug));
  if not found then raise exception 'tt:notfound'; end if;
  if not s.eval_open then raise exception 'tt:closed'; end if;
  if p_responses is null or jsonb_typeof(p_responses) <> 'object' then raise exception 'tt:invalid'; end if;

  v_name := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  v_unit := nullif(regexp_replace(btrim(coalesce(p_unit, '')), '\s+', ' ', 'g'), '');
  if char_length(coalesce(v_name, '')) > 100 or char_length(coalesce(v_unit, '')) > 100 then
    raise exception 'tt:invalid';
  end if;

  for r in select * from tt.eval_items where session_id = s.id order by no loop
    v := p_responses -> (r.no)::text;
    if r.kind in ('scale', 'nps') then
      if v is null or jsonb_typeof(v) <> 'number' then
        if r.required then raise exception 'tt:incomplete'; else continue; end if;
      end if;
      n := (v #>> '{}')::numeric;
      lo := case r.kind when 'scale' then 1 else 0 end;
      hi := case r.kind when 'scale' then 5 else 10 end;
      if n <> trunc(n) or n < lo or n > hi then raise exception 'tt:invalid'; end if;
      v_clean := v_clean || jsonb_build_object((r.no)::text, n::int);
    else
      t := btrim(coalesce(p_responses ->> (r.no)::text, ''));
      if char_length(t) > 1000 then raise exception 'tt:invalid'; end if;
      if t <> '' then
        v_clean := v_clean || jsonb_build_object((r.no)::text, t);
      elsif r.required then
        raise exception 'tt:incomplete';
      end if;
    end if;
  end loop;

  if (select count(*) from tt.eval_submissions where session_id = s.id) >= 500 then
    raise exception 'tt:full';
  end if;

  insert into tt.eval_submissions (session_id, name, unit, responses) values (s.id, v_name, v_unit, v_clean);
  return jsonb_build_object('ok', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Facilitator functions (protected by the admin passcode)
-- ---------------------------------------------------------------------------
create or replace function public.tt_admin_overview(p_slug text, p_pass text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s tt.sessions;
begin
  perform tt.admin_check(p_pass);
  select * into s from tt.sessions where slug = lower(btrim(p_slug));
  if not found then raise exception 'tt:notfound'; end if;

  return jsonb_build_object(
    'session', to_jsonb(s),
    'questions', (select coalesce(jsonb_agg(jsonb_build_object(
        'form', q.form, 'no', q.no, 'topic', q.topic, 'body', q.body, 'options', q.options,
        'correct', q.correct, 'slide_ref', q.slide_ref) order by q.form, q.no), '[]'::jsonb)
      from tt.questions q where q.session_id = s.id),
    'tests', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id, 'form', t.form, 'name', t.name, 'name_norm', t.name_norm, 'unit', t.unit,
        'answers', t.answers, 'score', t.score, 'total', t.total, 'duration_s', t.duration_s,
        'submitted_at', t.submitted_at) order by t.submitted_at), '[]'::jsonb)
      from tt.test_submissions t where t.session_id = s.id),
    'eval_items', (select coalesce(jsonb_agg(jsonb_build_object(
        'no', e.no, 'section', e.section, 'kind', e.kind, 'body', e.body) order by e.no), '[]'::jsonb)
      from tt.eval_items e where e.session_id = s.id),
    'evals', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', v.id, 'name', v.name, 'unit', v.unit, 'responses', v.responses,
        'submitted_at', v.submitted_at) order by v.submitted_at), '[]'::jsonb)
      from tt.eval_submissions v where v.session_id = s.id)
  );
end;
$$;

create or replace function public.tt_admin_set_flags(p_slug text, p_pass text, p_pre boolean, p_post boolean, p_eval boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s tt.sessions;
begin
  perform tt.admin_check(p_pass);
  update tt.sessions
     set pre_open = coalesce(p_pre, pre_open),
         post_open = coalesce(p_post, post_open),
         eval_open = coalesce(p_eval, eval_open)
   where slug = lower(btrim(p_slug))
  returning * into s;
  if not found then raise exception 'tt:notfound'; end if;
  return jsonb_build_object('pre_open', s.pre_open, 'post_open', s.post_open, 'eval_open', s.eval_open);
end;
$$;

create or replace function public.tt_admin_delete(p_slug text, p_pass text, p_kind text, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid uuid;
  v_rows int;
begin
  perform tt.admin_check(p_pass);
  select id into v_sid from tt.sessions where slug = lower(btrim(p_slug));
  if v_sid is null then raise exception 'tt:notfound'; end if;

  if p_kind = 'test' then
    delete from tt.test_submissions where id = p_id and session_id = v_sid;
  elsif p_kind = 'eval' then
    delete from tt.eval_submissions where id = p_id and session_id = v_sid;
  else
    raise exception 'tt:invalid';
  end if;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('deleted', v_rows);
end;
$$;

-- Only the API roles may call the public wrappers.
revoke all on function public.tt_get_session(text) from public;
revoke all on function public.tt_get_form(text, text) from public;
revoke all on function public.tt_submit_test(text, text, text, text, jsonb, int) from public;
revoke all on function public.tt_submit_eval(text, text, text, jsonb) from public;
revoke all on function public.tt_admin_overview(text, text) from public;
revoke all on function public.tt_admin_set_flags(text, text, boolean, boolean, boolean) from public;
revoke all on function public.tt_admin_delete(text, text, text, uuid) from public;

grant execute on function public.tt_get_session(text) to anon, authenticated;
grant execute on function public.tt_get_form(text, text) to anon, authenticated;
grant execute on function public.tt_submit_test(text, text, text, text, jsonb, int) to anon, authenticated;
grant execute on function public.tt_submit_eval(text, text, text, jsonb) to anon, authenticated;
grant execute on function public.tt_admin_overview(text, text) to anon, authenticated;
grant execute on function public.tt_admin_set_flags(text, text, boolean, boolean, boolean) to anon, authenticated;
grant execute on function public.tt_admin_delete(text, text, text, uuid) to anon, authenticated;
