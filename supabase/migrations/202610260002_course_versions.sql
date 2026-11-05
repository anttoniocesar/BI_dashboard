-- Concrete course IDs remain the foreign context for access, progress and attempts.
alter table public.courses add column course_family_id text;
alter table public.courses add column version_number integer not null default 1 check(version_number>0);
alter table public.courses add column based_on_course_id text references public.courses(id);
alter table public.courses add column published_at timestamptz;
update public.courses set course_family_id=id,published_at=case when status<>'draft' then created_at end;
alter table public.courses alter column course_family_id set not null;
create unique index course_family_version on public.courses(course_family_id,version_number);
create unique index course_family_one_draft on public.courses(course_family_id) where status='draft';
alter table public.course_chapters add column source_chapter_id text;
alter table public.course_activities add column source_activity_id text;

create function app_private.guard_course_version() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then
  if old.status<>'draft' or old.published_at is not null then raise exception 'Preserve published version' using errcode='23514'; end if;
  return old;
 end if;
 if tg_op='INSERT' then new.course_family_id:=coalesce(new.course_family_id,new.id); return new; end if;
 if (old.course_family_id,old.version_number,old.based_on_course_id) is distinct from (new.course_family_id,new.version_number,new.based_on_course_id) then raise exception 'Immutable version identity' using errcode='23514'; end if;
 if old.status<>'draft' and (to_jsonb(old)-'status'-'updated_at') is distinct from (to_jsonb(new)-'status'-'updated_at') then raise exception 'Published version is immutable' using errcode='23514'; end if;
 if old.status<>'draft' and new.status='draft' then raise exception 'Published version is immutable' using errcode='23514'; end if;
 if old.status='draft' and new.status='published' then new.published_at:=clock_timestamp(); end if;
 return new;
end $$;
create trigger course_version_guard before insert or update or delete on public.courses for each row execute function app_private.guard_course_version();

create function app_private.guard_course_content() returns trigger language plpgsql set search_path='' as $$
declare cid text; existing jsonb;
begin
 cid:=case when tg_op='DELETE' then old.course_id else new.course_id end;
 if exists(select 1 from public.courses where id=cid and status<>'draft') then
  if tg_op='DELETE' then raise exception 'Published content is immutable' using errcode='23514'; end if;
  if tg_table_name='course_chapters' then
   select to_jsonb(x)-'created_at'-'updated_at' into existing from public.course_chapters x where course_id=cid and id=new.id;
   if existing is not null then new.source_chapter_id:=existing->>'source_chapter_id'; end if;
  else
   select to_jsonb(x)-'created_at'-'updated_at' into existing from public.course_activities x where course_id=cid and chapter_id=new.chapter_id and id=new.id;
   if existing is not null then new.source_activity_id:=existing->>'source_activity_id'; end if;
  end if;
  if existing is distinct from (to_jsonb(new)-'created_at'-'updated_at') then raise exception 'Published content is immutable' using errcode='23514'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger chapter_version_guard before insert or update or delete on public.course_chapters for each row execute function app_private.guard_course_content();
create trigger activity_version_guard before insert or update or delete on public.course_activities for each row execute function app_private.guard_course_content();

alter function public.save_course_authoring(uuid,jsonb) rename to save_course_authoring_pre_versions;
revoke all on function public.save_course_authoring_pre_versions(uuid,jsonb) from public,anon,authenticated,service_role;
create function public.save_course_authoring(actor uuid,payload jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 if payload->>'operation'='save-course' and exists(select 1 from public.courses where id=payload->>'id' and status<>'draft') then raise exception 'Published version is immutable' using errcode='23514'; end if;
 if payload->>'operation'='publish' and not exists(select 1 from public.courses where id=payload->>'id' and status='draft') then raise exception 'Only drafts may publish' using errcode='23514'; end if;
 perform public.save_course_authoring_pre_versions(actor,payload);
end $$;
revoke all on function public.save_course_authoring(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_course_authoring(uuid,jsonb) to service_role;

create function public.create_course_revision(actor uuid,payload jsonb) returns text language plpgsql security definer set search_path='' as $$
declare s public.courses; ch public.course_chapters; a public.course_activities; nid text:=payload->>'newCourseId'; chid text; n integer;
begin
 if not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.id where p.id=actor and p.status='active' and r.role in ('teacher','admin')) then raise exception 'Denied' using errcode='42501'; end if;
 select * into s from public.courses where id=payload->>'sourceCourseId' for update;
 if not found then raise exception 'Source missing' using errcode='23503'; end if;
 if not exists(select 1 from public.user_roles where user_id=actor and role='admin') and s.created_by is distinct from actor and not exists(select 1 from public.course_teachers where user_id=actor and course_id=s.id) then raise exception 'Denied' using errcode='42501'; end if;
 if s.status<>'published' then raise exception 'Source must be published' using errcode='23514'; end if;
 if (payload->>'expectedUpdatedAt') is null or s.updated_at is distinct from (payload->>'expectedUpdatedAt')::timestamptz then raise exception 'Source changed' using errcode='40001'; end if;
 -- Family advisory lock serializes clones from different historical sources too.
 perform pg_advisory_xact_lock(hashtextextended(s.course_family_id,0));
 if exists(select 1 from public.courses where course_family_id=s.course_family_id and status='draft') then raise exception 'Active draft exists' using errcode='23505'; end if;
 if nid is null or length(nid) not between 1 and 160 or nid=s.id then raise exception 'Invalid identity' using errcode='22023'; end if;
 select coalesce(max(version_number),0)+1 into n from public.courses where course_family_id=s.course_family_id;
 insert into public.courses(id,title,description,objective,workload,status,service_type,image_label,created_by,course_family_id,version_number,based_on_course_id)
 values(nid,s.title,s.description,s.objective,s.workload,'draft',s.service_type,s.image_label,s.created_by,s.course_family_id,n,s.id);
 for ch in select * from public.course_chapters where course_id=s.id order by position loop
  chid:='chapter-'||gen_random_uuid()::text;
  insert into public.course_chapters(id,course_id,title,description,position,completion_policy,source_chapter_id) values(chid,nid,ch.title,ch.description,ch.position,ch.completion_policy,ch.id);
  for a in select * from public.course_activities where course_id=s.id and chapter_id=ch.id order by position loop
   insert into public.course_activities(id,course_id,chapter_id,type,title,description,position,required,navigation_group,exercise_id,exercise_version,metadata,source_activity_id)
   values('activity-'||gen_random_uuid()::text,nid,chid,a.type,a.title,a.description,a.position,a.required,a.navigation_group,a.exercise_id,a.exercise_version,a.metadata,a.id);
  end loop;
 end loop;
 insert into public.course_teachers(user_id,course_id) select user_id,nid from public.course_teachers where course_id=s.id on conflict do nothing;
 insert into public.course_teachers(user_id,course_id) select actor,nid where exists(select 1 from public.user_roles where user_id=actor and role='teacher') on conflict do nothing;
 return nid;
end $$;
revoke all on function public.create_course_revision(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.create_course_revision(uuid,jsonb) to service_role;

alter function public.course_workspace() rename to course_workspace_pre_versions;
revoke all on function public.course_workspace_pre_versions() from public,anon,authenticated;
create function public.course_workspace() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb:=public.course_workspace_pre_versions(); output jsonb:='[]'; entry jsonb; ch jsonb; a jsonb; chapters jsonb; activities jsonb; c public.courses; origin text;
begin
 for entry in select value from jsonb_array_elements(result->'courses') loop
  select * into c from public.courses where id=entry->>'id';
  entry:=entry||jsonb_strip_nulls(jsonb_build_object('courseFamilyId',c.course_family_id,'versionNumber',c.version_number,'basedOnCourseId',c.based_on_course_id,'publishedAt',c.published_at));chapters:='[]';
  for ch in select value from jsonb_array_elements(entry->'chapters') loop
   select source_chapter_id into origin from public.course_chapters where course_id=c.id and id=ch->>'id';
   if origin is not null then ch:=ch||jsonb_build_object('sourceChapterId',origin); end if;activities:='[]';
   for a in select value from jsonb_array_elements(ch->'activities') loop
    select source_activity_id into origin from public.course_activities where course_id=c.id and chapter_id=ch->>'id' and id=a->>'id';
    if origin is not null then a:=a||jsonb_build_object('sourceActivityId',origin); end if;activities:=activities||jsonb_build_array(a);
   end loop;
   chapters:=chapters||jsonb_build_array(jsonb_set(ch,'{activities}',activities));
  end loop;
  output:=output||jsonb_build_array(jsonb_set(entry,'{chapters}',chapters));
 end loop;
 return jsonb_set(result,'{courses}',output);
end $$;
revoke all on function public.course_workspace() from public,anon;
grant execute on function public.course_workspace() to authenticated;

-- Resolve only at grant time. Existing physical access rows are never rewritten.
create function app_private.pin_course_access() returns trigger language plpgsql security definer set search_path='' as $$
declare fam text; uid uuid; chosen text;
begin
 select course_family_id into fam from public.courses where id=new.course_id;
 if fam is null then return new; end if;
 select user_id into uid from public.user_services where id=new.user_service_id;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||':'||fam,0));
 select c.id into chosen from public.course_access ca join public.user_services us on us.id=ca.user_service_id join public.courses c on c.id=ca.course_id
 where us.user_id=uid and c.course_family_id=fam and c.status='published' order by c.version_number limit 1;
 if chosen is null then select id into chosen from public.courses where course_family_id=fam and status='published' order by version_number desc limit 1; end if;
 if chosen is null then raise exception 'No published version' using errcode='23514'; end if;
 new.course_id:=chosen;return new;
end $$;
create trigger course_access_version_pin before insert on public.course_access for each row execute function app_private.pin_course_access();
revoke all on function app_private.guard_course_version(),app_private.guard_course_content(),app_private.pin_course_access() from public,anon,authenticated;
