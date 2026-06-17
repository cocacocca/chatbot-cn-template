-- RPC: get_message_count_by_user_id
create or replace function public.get_message_count_by_user_id(
  since timestamptz default now() - interval '1 hour'
)
returns integer
language sql
security definer set search_path = public
as $$
  select count(*)::integer
  from public.message m
  inner join public.chat c on c.id = m.chat_id
  where c.user_id = auth.uid()
    and m.created_at >= since;
$$;

-- View: document_latest
create or replace view public.document_latest as
select distinct on (id) *
from public.document
order by id, created_at desc;
