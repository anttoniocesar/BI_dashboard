-- A narrow atomic update: CAS + authorization run under the same course lock.
-- No history/progress/attempt tables are written, no cascading deletes.
create function public.replace_activity_exercise(actor uuid, payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare c public.courses; a public.course_activities; e public.course_exercises;
begin
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id
   where p.id=actor and p.status='active' and r.role='teacher') then raise exception 'Denied' using errcode='42501'; end if;
 select * into c from public.courses where id=payload->>'id' for update;
 if not found or (c.created_by is distinct from actor and not exists(select 1 from public.course_teachers t where t.course_id=c.id and t.user_id=actor)) then raise exception 'Denied' using errcode='42501'; end if;
 if c.status<>'draft' then raise exception 'Preserve published activities' using errcode='23514'; end if;
 select * into a from public.course_activities where course_id=c.id and chapter_id=payload->>'chapterId' and id=payload->>'activityId' for update;
 if not found or a.type<>'spreadsheet-exercise' then raise exception 'Lab not found' using errcode='23514'; end if;
 if (payload->>'expectedUpdatedAt') is null or c.updated_at is distinct from (payload->>'expectedUpdatedAt')::timestamptz
   or a.exercise_id is distinct from payload->>'previousExerciseId' or a.exercise_version is distinct from payload->>'previousExerciseVersion'
   then raise exception 'Course revision changed' using errcode='40001'; end if;
 if a.exercise_id=payload->>'nextExerciseId' and a.exercise_version=payload->>'nextExerciseVersion' then raise exception 'Select another exercise' using errcode='23514'; end if;
 select * into e from public.course_exercises where id=payload->>'nextExerciseId' and version=payload->>'nextExerciseVersion' for key share;
 if not found then raise exception 'Exercise not found' using errcode='23503'; end if;
 if e.created_by is distinct from actor and not exists(select 1 from public.course_activities x join public.courses y on y.id=x.course_id
   where x.exercise_id=e.id and x.exercise_version=e.version and (y.created_by=actor or exists(select 1 from public.course_teachers t where t.course_id=y.id and t.user_id=actor)))
   then raise exception 'Denied' using errcode='42501'; end if;
 update public.course_activities set exercise_id=e.id,exercise_version=e.version,updated_at=clock_timestamp()
   where course_id=c.id and chapter_id=a.chapter_id and id=a.id;
 update public.courses set updated_at=greatest(clock_timestamp(),c.updated_at+interval '1 microsecond') where id=c.id;
end $$;
revoke all on function public.replace_activity_exercise(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.replace_activity_exercise(uuid,jsonb) to service_role;
