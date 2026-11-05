-- Stage 19: auth.users is the identity source. No password/email table.
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('student','teacher','admin')),
  created_at timestamptz not null default now(), primary key(user_id,role)
);
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  registration_code text not null unique check (registration_code ~ '^[0-9]{9}$'),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.services (
  id uuid primary key default gen_random_uuid(), type text not null unique check (type = 'standalone-course'),
  title text not null check (length(trim(title)) between 1 and 160), created_at timestamptz not null default now()
);
create table public.user_services (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,service_id)
);
create table public.course_access (
  id uuid primary key default gen_random_uuid(), user_service_id uuid not null references public.user_services(id) on delete cascade,
  course_id text not null check(length(trim(course_id)) between 1 and 160),
  created_at timestamptz not null default now(), unique(user_service_id,course_id)
);
create table public.course_teachers (
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null check(length(trim(course_id)) between 1 and 160),
  created_at timestamptz not null default now(), primary key(user_id,course_id)
);
create table public.student_progress (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id) on delete cascade,
  course_id text not null check(length(trim(course_id)) between 1 and 160),
  chapter_id text not null check(length(trim(chapter_id)) between 1 and 160),
  -- Empty activity is a chapter-position marker, never a completion.
  activity_id text not null check(length(activity_id) <= 160),
  status text not null check(status in ('not-started','in-progress','completed')),
  completed_at timestamptz, updated_at timestamptz not null default now(),
  unique(user_id,course_id,chapter_id,activity_id),
  check ((status = 'completed' and completed_at is not null and activity_id <> '') or (status <> 'completed' and completed_at is null))
);
create index course_access_course_idx on public.course_access(course_id);
create index user_services_user_idx on public.user_services(user_id);
create index student_progress_user_course_idx on public.student_progress(user_id,course_id);
create sequence app_private.registration_sequence maxvalue 99999;

create function app_private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function app_private.touch_updated_at();
create trigger enrollments_updated before update on public.enrollments for each row execute function app_private.touch_updated_at();
create trigger user_services_updated before update on public.user_services for each row execute function app_private.touch_updated_at();

create function app_private.new_auth_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id,name) values(new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'name'),''),'Novo usuário'),160));
  return new;
end $$;
create trigger auth_user_profile after insert on auth.users for each row execute function app_private.new_auth_profile();
insert into public.profiles(id,name) select id,left(coalesce(nullif(trim(raw_user_meta_data->>'name'),''),'Novo usuário'),160) from auth.users on conflict(id) do nothing;

-- Definers avoid recursive RLS on profiles/roles, use the authenticated uid only,
-- and expose booleans instead of arbitrary-user lookups.
create function app_private.active_user() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active');
$$;
create function app_private.has_role(wanted text) returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.active_user() and exists(select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = wanted);
$$;
create function app_private.can_study(wanted_course text) returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.has_role('student') and exists (
    select 1 from public.enrollments e join public.user_services us on us.user_id=e.user_id
    join public.course_access ca on ca.user_service_id=us.id
    where e.user_id=auth.uid() and e.status='active' and us.status='active' and ca.course_id=wanted_course
  );
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.enrollments enable row level security;
alter table public.services enable row level security;
alter table public.user_services enable row level security;
alter table public.course_access enable row level security;
alter table public.course_teachers enable row level security;
alter table public.student_progress enable row level security;

create policy profiles_read on public.profiles for select to authenticated using (app_private.active_user() and (id=auth.uid() or app_private.has_role('admin')));
create policy roles_read on public.user_roles for select to authenticated using (app_private.active_user() and (user_id=auth.uid() or app_private.has_role('admin')));
create policy enrollments_read on public.enrollments for select to authenticated using (app_private.active_user() and (user_id=auth.uid() or app_private.has_role('admin')));
create policy services_read on public.services for select to authenticated using (app_private.active_user() and (app_private.has_role('admin') or exists(select 1 from public.user_services us where us.service_id=services.id and us.user_id=auth.uid())));
create policy user_services_read on public.user_services for select to authenticated using (app_private.active_user() and (user_id=auth.uid() or app_private.has_role('admin')));
create policy course_access_read on public.course_access for select to authenticated using (app_private.active_user() and (app_private.has_role('admin') or exists(select 1 from public.user_services us where us.id=user_service_id and us.user_id=auth.uid())));
create policy teachers_read on public.course_teachers for select to authenticated using (app_private.active_user() and (app_private.has_role('admin') or (user_id=auth.uid() and app_private.has_role('teacher'))));
create policy progress_read on public.student_progress for select to authenticated using (app_private.active_user() and (user_id=auth.uid() or app_private.has_role('admin')));
-- Writes use narrow, authorized RPCs. No direct mutation grants/policies.
grant select on public.profiles,public.user_roles,public.enrollments,public.services,public.user_services,public.course_access,public.course_teachers,public.student_progress to authenticated;
revoke all on public.profiles,public.user_roles,public.enrollments,public.services,public.user_services,public.course_access,public.course_teachers,public.student_progress from anon;
revoke insert,update,delete on public.profiles,public.user_roles,public.enrollments,public.services,public.user_services,public.course_access,public.course_teachers,public.student_progress from authenticated;
grant all on public.profiles,public.user_roles,public.enrollments,public.services,public.user_services,public.course_access,public.course_teachers,public.student_progress to service_role;

create function public.app_snapshot() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare administrator boolean := app_private.has_role('admin'); result jsonb;
begin
  if not app_private.active_user() then raise exception 'not_authorized' using errcode='42501'; end if;
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name,'email',u.email,'status',p.status,'createdAt',p.created_at,'roles',coalesce((select jsonb_agg(r.role order by r.created_at,r.role) from public.user_roles r where r.user_id=p.id),'[]'::jsonb))) from public.profiles p join auth.users u on u.id=p.id where administrator or p.id=auth.uid()),'[]'::jsonb),
    'enrollments', coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'registrationCode',e.registration_code,'userId',e.user_id,'status',e.status,'createdAt',e.created_at)) from public.enrollments e where administrator or e.user_id=auth.uid()),'[]'::jsonb),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'type',s.type,'title',s.title)) from public.services s where administrator or exists(select 1 from public.user_services us where us.user_id=auth.uid() and us.service_id=s.id)),'[]'::jsonb),
    'userServices', coalesce((select jsonb_agg(jsonb_build_object('id',us.id,'userId',us.user_id,'serviceId',us.service_id,'status',us.status)) from public.user_services us where administrator or us.user_id=auth.uid()),'[]'::jsonb),
    'courseAccess', coalesce((select jsonb_agg(jsonb_build_object('userServiceId',ca.user_service_id,'courseId',ca.course_id)) from public.course_access ca join public.user_services us on us.id=ca.user_service_id where administrator or us.user_id=auth.uid()),'[]'::jsonb),
    'courseTeachers', coalesce((select jsonb_agg(jsonb_build_object('userId',ct.user_id,'courseId',ct.course_id)) from public.course_teachers ct where administrator or (ct.user_id=auth.uid() and app_private.has_role('teacher'))),'[]'::jsonb)
  ) into result;
  return result;
end $$;

create function public.admin_command(command jsonb) returns void language plpgsql security definer set search_path = '' as $$
declare kind text := command->>'type'; target uuid; selected_user uuid; code text; role_name text; link public.user_services;
begin
  if not app_private.has_role('admin') then raise exception 'not_authorized' using errcode='42501'; end if;
  if kind in ('create-user','update-user') then
    target := coalesce(command->>'userId',command->>'id')::uuid;
    if coalesce(jsonb_typeof(command->'roles') <> 'array',true) or jsonb_array_length(command->'roles') not between 1 and 3
      or exists(select 1 from jsonb_array_elements_text(command->'roles') r where r not in ('student','teacher','admin'))
      or coalesce(length(trim(command->>'name')),0) not between 1 and 160
      or coalesce(command->>'status','') not in ('active','inactive') then raise exception 'invalid_payload' using errcode='22023'; end if;
    update public.profiles set name=trim(command->>'name'),status=command->>'status' where id=target;
    if not found then raise exception 'missing_user' using errcode='22023'; end if;
    delete from public.user_roles where user_id=target;
    for role_name in select distinct jsonb_array_elements_text(command->'roles') loop insert into public.user_roles(user_id,role) values(target,role_name); end loop;
  elsif kind='enroll' then
    target := (command->>'userId')::uuid;
    if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id and r.role='student' where p.id=target and p.status='active') then raise exception 'student_required' using errcode='22023'; end if;
    loop
      code := to_char(now() at time zone 'America/Sao_Paulo','YYYY') || lpad(nextval('app_private.registration_sequence')::text,5,'0');
      exit when not exists(select 1 from public.enrollments e where e.registration_code=code);
    end loop;
    insert into public.enrollments(user_id,registration_code) values(target,code);
  elsif kind in ('enrollment-status','service-status') then
    if coalesce(command->>'status','') not in ('active','inactive') then raise exception 'invalid_status' using errcode='22023'; end if;
    if kind='enrollment-status' then update public.enrollments set status=command->>'status' where id=(command->>'id')::uuid;
    else update public.user_services set status=command->>'status' where id=(command->>'id')::uuid; end if;
    if not found then raise exception 'missing_link' using errcode='22023'; end if;
  elsif kind='assign-service' then
    target := (command->>'userId')::uuid;
    if not exists(select 1 from public.enrollments e join public.profiles p on p.id=e.user_id join public.user_roles r on r.user_id=p.id and r.role='student' where p.id=target and p.status='active' and e.status='active') then raise exception 'active_enrollment_required' using errcode='22023'; end if;
    insert into public.user_services(user_id,service_id) values(target,(command->>'serviceId')::uuid);
  elsif kind in ('grant-course','revoke-course') then
    if coalesce(length(trim(command->>'courseId')),0) not between 1 and 160 then raise exception 'invalid_course' using errcode='22023'; end if;
    select * into link from public.user_services where id=(command->>'userServiceId')::uuid;
    if not found then raise exception 'missing_link' using errcode='22023'; end if;
    if kind='revoke-course' then delete from public.course_access where user_service_id=link.id and course_id=command->>'courseId';
    else
      if link.status<>'active' or not exists(select 1 from public.enrollments e join public.profiles p on p.id=e.user_id join public.user_roles r on r.user_id=p.id and r.role='student' where p.id=link.user_id and p.status='active' and e.status='active') then raise exception 'active_student_required' using errcode='22023'; end if;
      insert into public.course_access(user_service_id,course_id) values(link.id,trim(command->>'courseId')) on conflict do nothing;
    end if;
  elsif kind='assign-teacher' then
    target := (command->>'userId')::uuid;
    if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id and r.role='teacher' where p.id=target and p.status='active') then raise exception 'teacher_required' using errcode='22023'; end if;
    insert into public.course_teachers(user_id,course_id) values(target,trim(command->>'courseId')) on conflict do nothing;
  else raise exception 'invalid_command' using errcode='22023'; end if;
end $$;

create function public.save_student_progress(course text, chapter text, activity text, progress_status text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.can_study(course) then raise exception 'not_authorized' using errcode='42501'; end if;
  if coalesce(length(trim(chapter)),0) not between 1 and 160 or activity is null or length(activity)>160 or progress_status not in ('in-progress','completed') or (activity='' and progress_status='completed') then raise exception 'invalid_progress' using errcode='22023'; end if;
  insert into public.student_progress(user_id,course_id,chapter_id,activity_id,status,completed_at)
    values(auth.uid(),course,chapter,activity,progress_status,case when progress_status='completed' then now() end)
  on conflict(user_id,course_id,chapter_id,activity_id) do update set
    status=case when student_progress.status='completed' then 'completed' else excluded.status end,
    completed_at=coalesce(student_progress.completed_at,excluded.completed_at),updated_at=now();
end $$;

create function public.course_teacher_names() returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('courseId',ct.course_id,'name',p.name)),'[]'::jsonb)
  from public.course_teachers ct join public.profiles p on p.id=ct.user_id and p.status='active'
  join public.user_roles r on r.user_id=p.id and r.role='teacher'
  where app_private.can_study(ct.course_id) or (ct.user_id=auth.uid() and app_private.has_role('teacher')) or app_private.has_role('admin');
$$;

revoke all on all functions in schema app_private from public,anon;
grant execute on function app_private.active_user(),app_private.has_role(text),app_private.can_study(text) to authenticated;
revoke all on function public.app_snapshot(),public.admin_command(jsonb),public.save_student_progress(text,text,text,text),public.course_teacher_names() from public,anon;
grant execute on function public.app_snapshot(),public.admin_command(jsonb),public.save_student_progress(text,text,text,text),public.course_teacher_names() to authenticated;
