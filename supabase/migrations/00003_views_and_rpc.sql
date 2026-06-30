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
create view public.cct_document_latest with (security_invoker = on) as
  SELECT DISTINCT ON (id) id,
     created_at,
     user_id,
     content,
     kind,
     title
    FROM cct_document
   ORDER BY id, created_at DESC;
