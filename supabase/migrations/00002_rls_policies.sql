-- 启用 RLS（model_config 除外）
alter table public.user_profile enable row level security;
alter table public.chat enable row level security;
alter table public.message enable row level security;
alter table public.vote enable row level security;
alter table public.document enable row level security;
alter table public.suggestion enable row level security;

-- ---------- user_profile ----------
create policy "users_select_own_profile"
  on public.user_profile for select
  using (auth.uid() = id);

create policy "users_update_own_profile"
  on public.user_profile for update
  using (auth.uid() = id);

create policy "users_delete_own_profile"
  on public.user_profile for delete
  using (auth.uid() = id);

-- ---------- chat ----------
create policy "users_select_own_or_public_chat"
  on public.chat for select
  using (auth.uid() = user_id or visibility = 'public');

create policy "users_insert_own_chat"
  on public.chat for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_chat"
  on public.chat for update
  using (auth.uid() = user_id);

create policy "users_delete_own_chat"
  on public.chat for delete
  using (auth.uid() = user_id);

-- ---------- message ----------
create policy "users_select_messages_in_own_or_public_chat"
  on public.message for select
  using (
    exists (
      select 1 from public.chat c
      where c.id = message.chat_id
        and (c.user_id = auth.uid() or c.visibility = 'public')
    )
  );

create policy "users_insert_messages_in_own_chat"
  on public.message for insert
  with check (
    exists (
      select 1 from public.chat c
      where c.id = chat_id and c.user_id = auth.uid()
    )
  );

create policy "users_update_messages_in_own_chat"
  on public.message for update
  using (
    exists (
      select 1 from public.chat c
      where c.id = message.chat_id and c.user_id = auth.uid()
    )
  );

create policy "users_delete_messages_in_own_chat"
  on public.message for delete
  using (
    exists (
      select 1 from public.chat c
      where c.id = message.chat_id and c.user_id = auth.uid()
    )
  );

-- ---------- vote ----------
create policy "users_select_votes_in_own_or_public_chat"
  on public.vote for select
  using (
    exists (
      select 1 from public.chat c
      where c.id = vote.chat_id
        and (c.user_id = auth.uid() or c.visibility = 'public')
    )
  );

create policy "users_modify_votes_in_own_chat"
  on public.vote for all
  using (
    exists (
      select 1 from public.chat c
      where c.id = vote.chat_id and c.user_id = auth.uid()
    )
  );

-- ---------- document ----------
create policy "users_select_own_documents"
  on public.document for select
  using (auth.uid() = user_id);

create policy "users_insert_own_documents"
  on public.document for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_documents"
  on public.document for update
  using (auth.uid() = user_id);

create policy "users_delete_own_documents"
  on public.document for delete
  using (auth.uid() = user_id);

-- ---------- suggestion ----------
create policy "users_select_own_suggestions"
  on public.suggestion for select
  using (auth.uid() = user_id);

create policy "users_insert_own_suggestions"
  on public.suggestion for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_suggestions"
  on public.suggestion for update
  using (auth.uid() = user_id);

create policy "users_delete_own_suggestions"
  on public.suggestion for delete
  using (auth.uid() = user_id);
