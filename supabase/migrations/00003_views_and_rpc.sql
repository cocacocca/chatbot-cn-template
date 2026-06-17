-- RPC: cct_get_message_count_by_user_id
create or replace function public.cct_get_message_count_by_user_id(
  since timestamptz default now() - interval '1 hour'
)
returns integer
language sql
security definer set search_path = public
as $$
  select count(*)::integer
  from public.cct_message m
  inner join public.cct_chat c on c.id = m.chat_id
  where c.user_id = auth.uid()
    and m.created_at >= since;
$$;

-- View: cct_document_latest
create or replace view public.cct_document_latest as
select distinct on (id) *
from public.cct_document
order by id, created_at desc;
