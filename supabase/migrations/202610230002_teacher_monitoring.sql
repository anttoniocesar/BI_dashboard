-- Stage 20. Narrow educational projection; no new progress/status tables.
-- Keep administrative RLS intact. Teachers gain access only through this RPC.
create function public.teacher_course_progress(requested_course text default null, requested_student uuid default null)
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
  from public.course_teachers courses where courses.user_id=auth.uid() and (requested_course is null or courses.course_id=requested_course);

  if requested_student is not null and jsonb_array_length(result->0->'students')=0 then
    raise exception 'student_not_available' using errcode='P0002';
  end if;
  return result;
end $$;
revoke all on function public.teacher_course_progress(text,uuid) from public,anon;
grant execute on function public.teacher_course_progress(text,uuid) to authenticated;
