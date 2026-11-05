-- Optional, idempotent development service; no users or passwords in SQL.
insert into public.services(id,type,title)
values('00000000-0000-4000-8000-000000000001','standalone-course','Curso Avulso')
on conflict(type) do nothing;
