-- Assignments belong to physical chapters, so revisions retain them with new IDs.
alter table public.course_chapters add column trail_point_id text
 check (trail_point_id is null or trail_point_id ~ '^P([1-9]|1[0-5])$');
alter table public.course_chapters add constraint course_chapter_unique_trail
 unique(course_id,trail_point_id) deferrable initially deferred;

create or replace function app_private.upsert_course(c jsonb) returns void language plpgsql set search_path='' as $$
declare ch jsonb; a jsonb; cid text:=c->>'id';
begin
 insert into public.courses(id,title,description,objective,workload,status,service_type,image_label,created_by)
 values(cid,c->>'title',c->>'description',c->>'objective',(c->>'workload')::numeric,c->>'status',c->>'service',c->'image'->>'label',(c->>'createdBy')::uuid)
 on conflict(id) do update set title=excluded.title,description=excluded.description,objective=excluded.objective,workload=excluded.workload,
 status=excluded.status,image_label=excluded.image_label,updated_at=clock_timestamp();
 for ch in select * from jsonb_array_elements(c->'chapters') loop
  insert into public.course_chapters(id,course_id,title,description,position,completion_policy,trail_point_id)
  values(ch->>'id',cid,ch->>'title',coalesce(ch->>'description',''),(ch->>'order')::int,ch->>'completionPolicy',ch->>'trailPointId')
  on conflict(course_id,id) do update set title=excluded.title,description=excluded.description,position=excluded.position,completion_policy=excluded.completion_policy,trail_point_id=excluded.trail_point_id,updated_at=clock_timestamp();
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

alter function public.save_course_authoring(uuid,jsonb) rename to save_course_authoring_pre_journey;
revoke all on function public.save_course_authoring_pre_journey(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.save_course_authoring(actor uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare p text; previous integer:=0; n integer; idx integer:=0;
begin
 if payload->>'operation'='publish' and (select count(*) from public.course_chapters where course_id=payload->>'id')>15 then raise exception 'A jornada visual suporta até 15 capítulos.' using errcode='23514'; end if;
 if payload->>'operation'='publish' and exists(select 1 from public.course_chapters where course_id=payload->>'id' and trail_point_id is not null) then
  for p in select trail_point_id from public.course_chapters where course_id=payload->>'id' order by position loop
   idx:=idx+1; n:=substring(p from 2)::integer;
   if p is null or (idx=1 and p<>'P1') or n<=previous then raise exception 'Ajuste as posições da jornada antes de publicar.' using errcode='23514'; end if;
   previous:=n;
  end loop;
 end if;
 perform public.save_course_authoring_pre_journey(actor,payload);

end $$;
revoke all on function public.save_course_authoring(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_course_authoring(uuid,jsonb) to service_role;

alter function public.create_course_revision(uuid,jsonb) rename to create_course_revision_pre_journey;
revoke all on function public.create_course_revision_pre_journey(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.create_course_revision(actor uuid,payload jsonb) returns text language plpgsql security definer set search_path='' as $$
declare nid text;
begin
 nid:=public.create_course_revision_pre_journey(actor,payload);
 update public.course_chapters dest set trail_point_id=src.trail_point_id
 from public.course_chapters src where dest.course_id=nid and src.course_id=payload->>'sourceCourseId' and src.id=dest.source_chapter_id;
 return nid;
end $$;
revoke all on function public.create_course_revision(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_course_revision(uuid,jsonb) to service_role;

alter function public.course_workspace() rename to course_workspace_pre_journey;
revoke all on function public.course_workspace_pre_journey() from public,anon,authenticated;
create function public.course_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb:=public.course_workspace_pre_journey(); output jsonb:='[]'; entry jsonb; ch jsonb; chapters jsonb; point text;
begin
 for entry in select value from jsonb_array_elements(result->'courses') loop
  chapters:='[]';
  for ch in select value from jsonb_array_elements(entry->'chapters') loop
   select trail_point_id into point from public.course_chapters where course_id=entry->>'id' and id=ch->>'id';
   if point is not null then ch:=ch||jsonb_build_object('trailPointId',point); end if;
   chapters:=chapters||jsonb_build_array(ch);
  end loop;
  output:=output||jsonb_build_array(jsonb_set(entry,'{chapters}',chapters));
 end loop;
 return jsonb_set(result,'{courses}',output);
end $$;
revoke all on function public.course_workspace() from public,anon;
grant execute on function public.course_workspace() to authenticated;
