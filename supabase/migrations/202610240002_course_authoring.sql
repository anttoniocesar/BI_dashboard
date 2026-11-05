-- Persistent authorship. Normalized identity/order fields; JSON only for type-specific content.
create table public.courses (
 id text primary key check(length(id) between 1 and 160), title text not null check(length(trim(title))>0),
 description text not null default '', objective text not null default '', workload numeric not null check(workload>=0),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 service_type text not null check(service_type='standalone-course'), image_label text not null,
 created_by uuid references public.profiles(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.course_exercises (
 id text not null, version text not null, title text not null, created_by uuid references public.profiles(id),
 author_draft jsonb not null, execution_definition jsonb not null, allowed_cells jsonb not null, sheets jsonb not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(id,version)
);
create table public.course_chapters (
 id text not null, course_id text not null references public.courses(id) on delete cascade,
 title text not null, description text not null default '', position integer not null check(position>0),
 completion_policy text not null check(completion_policy='all-required-activities'),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), primary key(course_id,id)
);
create table public.course_activities (
 id text not null, course_id text not null, chapter_id text not null,
 type text not null check(type in ('video','text','material','assessment','spreadsheet-exercise')),
 title text not null, description text not null default '', position integer not null check(position>0), required boolean not null,
 navigation_group text check(navigation_group in ('video-lesson','video-application','laboratory')),
 exercise_id text, exercise_version text, metadata jsonb not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 primary key(course_id,chapter_id,id), foreign key(course_id,chapter_id) references public.course_chapters(course_id,id) on delete cascade,
 foreign key(exercise_id,exercise_version) references public.course_exercises(id,version),
 check((type='spreadsheet-exercise' and exercise_id is not null and exercise_version is not null) or (type<>'spreadsheet-exercise' and exercise_id is null and exercise_version is null))
);
create index course_chapters_order on public.course_chapters(course_id,position);
create index course_activities_order on public.course_activities(course_id,chapter_id,position);

create function app_private.can_edit_course(wanted text) returns boolean language sql stable security definer set search_path='' as $$
 select app_private.has_role('teacher') and exists(select 1 from public.courses c where c.id=wanted and
 (c.created_by=auth.uid() or exists(select 1 from public.course_teachers t where t.course_id=c.id and t.user_id=auth.uid())));
$$;
create or replace function app_private.can_study(wanted_course text) returns boolean language sql stable security definer set search_path='' as $$
 select app_private.has_role('student') and exists(select 1 from public.courses c where c.id=wanted_course and c.status='published') and exists (
 select 1 from public.enrollments e join public.user_services us on us.user_id=e.user_id join public.course_access ca on ca.user_service_id=us.id
 where e.user_id=auth.uid() and e.status='active' and us.status='active' and ca.course_id=wanted_course);
$$;
alter table public.courses enable row level security;
alter table public.course_chapters enable row level security;
alter table public.course_activities enable row level security;
alter table public.course_exercises enable row level security;
create policy course_read on public.courses for select to authenticated using(app_private.has_role('admin') or app_private.can_edit_course(id) or app_private.can_study(id));
create policy chapter_read on public.course_chapters for select to authenticated using(app_private.has_role('admin') or app_private.can_edit_course(course_id) or app_private.can_study(course_id));
create policy activity_read on public.course_activities for select to authenticated using(app_private.has_role('admin') or app_private.can_edit_course(course_id) or app_private.can_study(course_id));
revoke all on public.courses,public.course_chapters,public.course_activities,public.course_exercises from anon,authenticated;
grant select on public.courses,public.course_chapters,public.course_activities to authenticated;
grant all on public.courses,public.course_chapters,public.course_activities,public.course_exercises to service_role;

-- Owner-only aggregate writer. Updates preserve IDs, creation dates and all progress/attempt rows.
create function app_private.upsert_course(c jsonb) returns void language plpgsql set search_path='' as $$
declare ch jsonb; a jsonb; cid text:=c->>'id';
begin
 insert into public.courses(id,title,description,objective,workload,status,service_type,image_label,created_by)
 values(cid,c->>'title',c->>'description',c->>'objective',(c->>'workload')::numeric,c->>'status',c->>'service',c->'image'->>'label',(c->>'createdBy')::uuid)
 on conflict(id) do update set title=excluded.title,description=excluded.description,objective=excluded.objective,workload=excluded.workload,
 status=excluded.status,image_label=excluded.image_label,updated_at=clock_timestamp();
 for ch in select * from jsonb_array_elements(c->'chapters') loop
  insert into public.course_chapters(id,course_id,title,description,position,completion_policy)
  values(ch->>'id',cid,ch->>'title',coalesce(ch->>'description',''),(ch->>'order')::int,ch->>'completionPolicy')
  on conflict(course_id,id) do update set title=excluded.title,description=excluded.description,position=excluded.position,completion_policy=excluded.completion_policy,updated_at=clock_timestamp();
  for a in select * from jsonb_array_elements(ch->'activities') loop
   insert into public.course_activities(id,course_id,chapter_id,type,title,description,position,required,navigation_group,exercise_id,exercise_version,metadata)
   values(a->>'id',cid,ch->>'id',a->>'type',a->>'title',case when a->>'type'='assessment' then coalesce(a->'content'->>'description','') else '' end,
   (a->>'order')::int,(a->>'required')::boolean,a->>'navigationGroup',a->'content'->>'exerciseId',a->'content'->>'exerciseVersion',
   (a->'content')-'exerciseId'-'exerciseVersion'-'description')
   on conflict(course_id,chapter_id,id) do update set type=excluded.type,title=excluded.title,description=excluded.description,position=excluded.position,
   required=excluded.required,navigation_group=excluded.navigation_group,exercise_id=excluded.exercise_id,exercise_version=excluded.exercise_version,metadata=excluded.metadata,updated_at=clock_timestamp();
  end loop;
  delete from public.course_activities x where x.course_id=cid and x.chapter_id=ch->>'id' and not exists(select 1 from jsonb_array_elements(ch->'activities') y where y->>'id'=x.id);
 end loop;
 delete from public.course_chapters x where x.course_id=cid and not exists(select 1 from jsonb_array_elements(c->'chapters') y where y->>'id'=x.id);
 if c->>'status'='published' then
  insert into public.published_lab_activities(course_id,chapter_id,activity_id,exercise_id,exercise_version,allowed_cells,sheets)
  select a.course_id,a.chapter_id,a.id,a.exercise_id,a.exercise_version,e.allowed_cells,e.sheets from public.course_activities a
  join public.course_exercises e on e.id=a.exercise_id and e.version=a.exercise_version where a.course_id=cid and a.type='spreadsheet-exercise' on conflict do nothing;
 end if;
end $$;
revoke all on function app_private.upsert_course(jsonb) from public,anon,authenticated;

-- This RPC is service-only: the API validates runtime DTOs, structure, immutable Labs and verified actor.
-- A direct authenticated RPC call cannot bypass the API validation.
create function public.save_course_authoring(actor uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare c jsonb:=payload->'course'; e jsonb:=payload->'exercise'; cid text:=payload->>'id'; old public.courses;
begin
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=actor and p.status='active' and r.role='teacher') then raise exception 'Denied' using errcode='42501'; end if;
 if payload->>'operation'='save-exercise' then
  if exists(select 1 from public.course_exercises x where x.id=e->>'id' and x.version=e->'definition'->>'version' and x.author_draft<>e->'draft'
   and exists(select 1 from public.course_activities a join public.courses c on c.id=a.course_id where c.status<>'draft' and a.exercise_id=x.id and a.exercise_version=x.version)) then raise exception 'Published exercise version is immutable' using errcode='23514'; end if;
  if exists(select 1 from public.course_exercises x where x.id=e->>'id' and x.version=e->'definition'->>'version' and x.created_by is distinct from actor)
   and not exists(select 1 from public.course_activities a join public.courses c on c.id=a.course_id where a.exercise_id=e->>'id' and a.exercise_version=e->'definition'->>'version' and
    (c.created_by=actor or exists(select 1 from public.course_teachers t where t.course_id=c.id and t.user_id=actor))) then raise exception 'Denied' using errcode='42501'; end if;
  insert into public.course_exercises(id,version,title,created_by,author_draft,execution_definition,allowed_cells,sheets)
  values(e->>'id',e->'definition'->>'version',e->'definition'->>'title',actor,e->'draft',payload->'definition',payload->'manifest'->'allowedCells',payload->'manifest'->'sheets')
  on conflict(id,version) do update set title=excluded.title,author_draft=excluded.author_draft,execution_definition=excluded.execution_definition,allowed_cells=excluded.allowed_cells,sheets=excluded.sheets,updated_at=clock_timestamp();
  return;
 end if;
 select * into old from public.courses where id=cid for update;
 if found and old.created_by is distinct from actor and not exists(select 1 from public.course_teachers t where t.course_id=cid and t.user_id=actor) then raise exception 'Denied' using errcode='42501'; end if;
 if payload->>'operation'='delete-draft' then
  if old.status is distinct from 'draft' or exists(select 1 from public.student_progress where course_id=cid) or exists(select 1 from public.exercise_attempts where course_id=cid) or exists(select 1 from public.course_access where course_id=cid) then raise exception 'Course in use' using errcode='23514'; end if;
  delete from public.course_teachers where course_id=cid;
  delete from public.courses where id=cid; return;
 end if;
 if old.id is null then c:=jsonb_set(c,'{createdBy}',to_jsonb(actor)); end if;
 if old.id is not null and payload->>'operation'='save-course' then
  c:=jsonb_set(c,'{status}',to_jsonb(old.status));
  if old.status<>'draft' and exists(select 1 from public.course_chapters ch where ch.course_id=cid and not exists(select 1 from jsonb_array_elements(c->'chapters') x where x->>'id'=ch.id)) then raise exception 'Preserve published chapters' using errcode='23514'; end if;
  if old.status<>'draft' and exists(select 1 from public.course_activities a where a.course_id=cid and not exists(
   select 1 from jsonb_array_elements(c->'chapters') ch cross join lateral jsonb_array_elements(ch->'activities') x
   where ch->>'id'=a.chapter_id and x->>'id'=a.id and x->>'type'=a.type and (a.type<>'spreadsheet-exercise' or
    (x->>'type'=a.type and x->'content'->>'exerciseId'=a.exercise_id and x->'content'->>'exerciseVersion'=a.exercise_version)))) then raise exception 'Preserve published activities' using errcode='23514'; end if;
 end if;
 perform app_private.upsert_course(c);
 insert into public.course_teachers(user_id,course_id) values(actor,cid) on conflict do nothing;
end $$;
revoke all on function public.save_course_authoring(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_course_authoring(uuid,jsonb) to service_role;

create function public.course_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not app_private.active_user() then raise exception 'Denied' using errcode='42501'; end if;
 with visible as (select c.* from public.courses c where app_private.has_role('admin') or app_private.can_edit_course(c.id) or app_private.can_study(c.id)),
 private_exercises as (select e.* from public.course_exercises e where app_private.has_role('teacher') and (e.created_by=auth.uid() or exists(
 select 1 from public.course_activities a where app_private.can_edit_course(a.course_id) and a.exercise_id=e.id and a.exercise_version=e.version))),
 definitions as (select e.* from public.course_exercises e where exists(select 1 from private_exercises x where x.id=e.id and x.version=e.version) or exists(
 select 1 from public.course_activities a join visible v on v.id=a.course_id where a.exercise_id=e.id and a.exercise_version=e.version))
 select jsonb_build_object('courses',coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'title',v.title,'description',v.description,'objective',v.objective,'workload',v.workload,
 'status',v.status,'service',v.service_type,'image',jsonb_build_object('kind','placeholder','label',v.image_label),'createdBy',v.created_by,'createdByName',(select name from public.profiles where id=v.created_by),'createdAt',v.created_at,'updatedAt',v.updated_at,
 'chapters',coalesce((select jsonb_agg(jsonb_build_object('id',ch.id,'title',ch.title,'description',ch.description,'order',ch.position,'completionPolicy',ch.completion_policy,
 'activities',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'type',a.type,'order',a.position,'required',a.required,'navigationGroup',a.navigation_group,
 'content',case when a.type='spreadsheet-exercise' then jsonb_build_object('exerciseId',a.exercise_id,'exerciseVersion',a.exercise_version) when a.type='assessment' then jsonb_build_object('description',a.description) else a.metadata end)
 order by a.position) from public.course_activities a where a.course_id=v.id and a.chapter_id=ch.id),'[]'::jsonb)) order by ch.position) from public.course_chapters ch where ch.course_id=v.id),'[]'::jsonb))) from visible v),'[]'::jsonb),
 'exercises',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'draft',e.author_draft,'definition',e.author_draft-'importedWorkbook','updatedAt',e.updated_at,'createdBy',e.created_by)) from private_exercises e),'[]'::jsonb),
 'definitions',coalesce((select jsonb_object_agg('['||to_json(e.id)::text||','||to_json(e.version)::text||']',e.execution_definition) from definitions e),'{}'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.course_workspace() from public,anon;
grant execute on function public.course_workspace() to authenticated;
-- Stage 20. Narrow educational projection; no new progress/status tables.
-- Keep administrative RLS intact. Teachers gain access only through this RPC.
create or replace function public.teacher_course_progress(requested_course text default null, requested_student uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not app_private.has_role('teacher') then raise exception 'not_authorized' using errcode='42501'; end if;
  if requested_student is not null and requested_course is null then raise exception 'invalid_request' using errcode='22023'; end if;
  if requested_course is not null and not exists (
    select 1 from public.course_teachers ct where ct.user_id=auth.uid() and ct.course_id=requested_course
  ) then raise exception 'not_authorized' using errcode='42501'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('courseId',courses.course_id,'students',(
    select coalesce(jsonb_agg(jsonb_build_object(
      'userId',p.id,'name',p.name,'registrationCode',e.registration_code,
      'rows',(select coalesce(jsonb_agg(jsonb_build_object(
        'course_id',sp.course_id,'chapter_id',sp.chapter_id,'activity_id',sp.activity_id,
        'status',sp.status,'updated_at',sp.updated_at,'completed_at',sp.completed_at
      ) order by sp.updated_at,sp.activity_id),'[]'::jsonb) from public.student_progress sp where sp.user_id=p.id and sp.course_id=courses.course_id)
    ) order by p.name,p.id),'[]'::jsonb)
    from public.profiles p join public.enrollments e on e.user_id=p.id and e.status='active'
    where p.status='active' and exists(select 1 from public.user_roles r where r.user_id=p.id and r.role='student')
      and (requested_student is null or p.id=requested_student)
      and exists(select 1 from public.user_services us join public.course_access ca on ca.user_service_id=us.id
        where us.user_id=p.id and us.status='active' and ca.course_id=courses.course_id)
  )) order by courses.course_id),'[]'::jsonb) into result
  from public.course_teachers courses join public.courses catalog on catalog.id=courses.course_id and catalog.status='published' where courses.user_id=auth.uid() and (requested_course is null or courses.course_id=requested_course);

  if requested_student is not null and jsonb_array_length(result->0->'students')=0 then
    raise exception 'student_not_available' using errcode='P0002';
  end if;
  return result;
end $$;
revoke all on function public.teacher_course_progress(text,uuid) from public,anon;
grant execute on function public.teacher_course_progress(text,uuid) to authenticated;

create or replace function public.save_student_progress(course text, chapter text, activity text, progress_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not app_private.can_study(course) then raise exception 'not_authorized' using errcode='42501'; end if;
 if progress_status is null or progress_status not in ('in-progress','completed') or activity is null or (activity='' and progress_status='completed') or
 not exists(select 1 from public.course_chapters ch where ch.course_id=course and ch.id=chapter) or
 (activity<>'' and not exists(select 1 from public.course_activities a where a.course_id=course and a.chapter_id=chapter and a.id=activity)) then raise exception 'invalid_progress' using errcode='22023'; end if;
 insert into public.student_progress(user_id,course_id,chapter_id,activity_id,status,completed_at)
 values(auth.uid(),course,chapter,activity,progress_status,case when progress_status='completed' then now() end)
 on conflict(user_id,course_id,chapter_id,activity_id) do update set status=case when student_progress.status='completed' then 'completed' else excluded.status end,completed_at=coalesce(student_progress.completed_at,excluded.completed_at),updated_at=now();
end $$;
