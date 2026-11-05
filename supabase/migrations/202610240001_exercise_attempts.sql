-- Incremental Stage 22. Published identity/allowed inputs only: no answer keys.
create table public.published_lab_activities (
  course_id text not null, chapter_id text not null, activity_id text not null,
  exercise_id text not null, exercise_version text not null,
  allowed_cells jsonb not null, sheets jsonb not null,
  primary key(course_id,chapter_id,activity_id,exercise_id,exercise_version)
);
create table public.exercise_attempts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null, chapter_id text not null, activity_id text not null,
  exercise_id text not null, exercise_version text not null,
  status text not null default 'draft' check(status in ('draft','submitted')),
  state jsonb, revision bigint not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), submitted_at timestamptz,
  unique(user_id,course_id,chapter_id,activity_id,exercise_id,exercise_version),
  foreign key(course_id,chapter_id,activity_id,exercise_id,exercise_version)
    references public.published_lab_activities(course_id,chapter_id,activity_id,exercise_id,exercise_version),
  check(state is null or octet_length(state::text) <= 262144)
);
alter table public.published_lab_activities enable row level security;
alter table public.exercise_attempts enable row level security;
create policy published_labs_read on public.published_lab_activities for select to authenticated using(app_private.can_study(course_id));
create policy own_attempt_read on public.exercise_attempts for select to authenticated using(user_id=auth.uid() and app_private.can_study(course_id));
revoke all on public.exercise_attempts, public.published_lab_activities from anon, authenticated;
grant select on public.exercise_attempts, public.published_lab_activities to authenticated;
grant all on public.exercise_attempts, public.published_lab_activities to service_role;

-- Current deployed neural definition: 23 writable positions, four 40 x 12 sheets.
insert into public.published_lab_activities(course_id,chapter_id,activity_id,exercise_id,exercise_version,allowed_cells,sheets)
select course_id,chapter_id,activity_id,'neural-error-correction','1.0',
  (select jsonb_agg(cell) from (
    select 'treinamento!'||col||row_number as cell from unnest(array['F','H','I','J']) col cross join generate_series(2,6) row_number
    union all select 'analise!'||cell from unnest(array['B3','B6','B9']) cell
  ) writable), '{"dados":{"rows":40,"columns":12},"treinamento":{"rows":40,"columns":12},"resultados":{"rows":40,"columns":12},"analise":{"rows":40,"columns":12}}'::jsonb
from (
  select course_id,'fundamentos' chapter_id,'fundamentos-lab-'||n activity_id
    from unnest(array['neural-demo','neural-pilot']) course_id cross join generate_series(1,6) n
  union all select course_id,'correcao','neural-lab' from unnest(array['neural-demo','neural-pilot']) course_id
  union all select 'chapter-navigation-demo','fundamentos','navigation-lab-'||n from generate_series(1,6) n
) identities
on conflict do nothing;

create function public.exercise_attempt_operation(operation text, identity jsonb, saved_state jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  manifest public.published_lab_activities; attempt public.exercise_attempts;
  actor uuid := auth.uid(); entry jsonb; selected record; seen text[] := array[]::text[]; cell_key text;
begin
  if actor is null or not app_private.can_study(identity->>'courseId') then raise exception 'Denied' using errcode='42501'; end if;
  if operation is null or operation not in ('load','save','clear') or identity is null or jsonb_typeof(identity)<>'object' or
    (select count(*) from jsonb_object_keys(identity))<>5 or exists(select 1 from jsonb_object_keys(identity) k where k not in ('courseId','chapterId','activityId','exerciseId','exerciseVersion')) then
    raise exception 'Invalid identity' using errcode='22023'; end if;
  select * into manifest from public.published_lab_activities m where
    m.course_id=identity->>'courseId' and m.chapter_id=identity->>'chapterId' and m.activity_id=identity->>'activityId'
    and m.exercise_id=identity->>'exerciseId' and m.exercise_version=identity->>'exerciseVersion';
  if not found then raise exception 'Unknown activity/version' using errcode='22023'; end if;
  if operation='save' then
    if saved_state is null or jsonb_typeof(saved_state)<>'object' or octet_length(saved_state::text)>262144 or
      (select count(*) from jsonb_object_keys(saved_state))<>8 or
      exists(select 1 from jsonb_object_keys(saved_state) k where k not in ('version','exerciseId','exerciseVersion','cells','activeSheet','selections','validation','lastSavedAt')) or
      coalesce(saved_state->>'version','')<>'1' or coalesce(saved_state->>'exerciseId','')<>manifest.exercise_id or coalesce(saved_state->>'exerciseVersion','')<>manifest.exercise_version or
      jsonb_typeof(saved_state->'activeSheet')<>'string' or saved_state->>'activeSheet' is null or saved_state->>'validation' is null or saved_state->>'lastSavedAt' is null or
      not (manifest.sheets ? (saved_state->>'activeSheet')) or saved_state->>'validation' not in ('never','verified','unverified') or
      jsonb_typeof(saved_state->'cells')<>'array' or jsonb_typeof(saved_state->'selections')<>'object' then raise exception 'Invalid state' using errcode='22023'; end if;
    for entry in select * from jsonb_array_elements(saved_state->'cells') loop
      cell_key := (entry->>'worksheetId')||'!'||(entry->>'address');
      if jsonb_typeof(entry)<>'object' or (select count(*) from jsonb_object_keys(entry))<>3 or cell_key is null or
        not (manifest.allowed_cells ? cell_key) or jsonb_typeof(entry->'raw') is distinct from 'string' or length(entry->>'raw')>16384 or cell_key=any(seen) then
        raise exception 'Invalid input cell' using errcode='22023'; end if;
      seen := array_append(seen,cell_key);
    end loop;
    for selected in select * from jsonb_each(saved_state->'selections') loop
      if not (manifest.sheets ? selected.key) or jsonb_typeof(selected.value)<>'object' or
        (select count(*) from jsonb_object_keys(selected.value))<>2 or
        coalesce(selected.value->>'row','') !~ '^[0-9]+$' or coalesce(selected.value->>'column','') !~ '^[0-9]+$' or
        (selected.value->>'row')::numeric >= (manifest.sheets->selected.key->>'rows')::numeric or
        (selected.value->>'column')::numeric >= (manifest.sheets->selected.key->>'columns')::numeric then raise exception 'Invalid selection' using errcode='22023'; end if;
    end loop;
    saved_state := jsonb_set(saved_state,'{lastSavedAt}',to_jsonb(clock_timestamp()));
  end if;
  if operation in ('save','clear') then
    insert into public.exercise_attempts as current(user_id,course_id,chapter_id,activity_id,exercise_id,exercise_version,state,status,submitted_at)
      values(actor,manifest.course_id,manifest.chapter_id,manifest.activity_id,manifest.exercise_id,manifest.exercise_version,
      case when operation='clear' then null else saved_state end,
      case when operation='save' and saved_state->>'validation'='verified' then 'submitted' else 'draft' end,
      case when operation='save' and saved_state->>'validation'='verified' then clock_timestamp() else null end)
    on conflict(user_id,course_id,chapter_id,activity_id,exercise_id,exercise_version) do update set
      state=excluded.state,status=excluded.status,submitted_at=excluded.submitted_at,updated_at=clock_timestamp(),revision=current.revision+1
    returning * into attempt;
  else
    select * into attempt from public.exercise_attempts a where a.user_id=actor and a.course_id=manifest.course_id and
      a.chapter_id=manifest.chapter_id and a.activity_id=manifest.activity_id and a.exercise_id=manifest.exercise_id and a.exercise_version=manifest.exercise_version;
  end if;
  return jsonb_build_object('state',attempt.state,'lastSavedAt',coalesce(attempt.updated_at,clock_timestamp()));
end $$;
revoke all on function public.exercise_attempt_operation(text,jsonb,jsonb) from public,anon;
grant execute on function public.exercise_attempt_operation(text,jsonb,jsonb) to authenticated;
