-- 启用 RLS（cct_model_config 除外）
alter table public.cct_user_profile enable row level security;
alter table public.cct_chat enable row level security;
alter table public.cct_message enable row level security;
alter table public.cct_vote enable row level security;
alter table public.cct_document enable row level security;
alter table public.cct_suggestion enable row level security;

-- ---------- cct_user_profile ----------
create policy "users_select_own_profile"
  on public.cct_user_profile for select
  using (auth.uid() = id);

create policy "users_update_own_profile"
  on public.cct_user_profile for update
  using (auth.uid() = id);

create policy "users_delete_own_profile"
  on public.cct_user_profile for delete
  using (auth.uid() = id);

-- ---------- cct_chat ----------
drop policy if exists "users_select_own_or_public_chat" on public.cct_chat;
create policy "users_select_own_chat"
  on public.cct_chat for select
  using (auth.uid() = user_id);

create policy "users_insert_own_chat"
  on public.cct_chat for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_chat"
  on public.cct_chat for update
  using (auth.uid() = user_id);

create policy "users_delete_own_chat"
  on public.cct_chat for delete
  using (auth.uid() = user_id);

-- ---------- cct_message ----------
drop policy if exists "users_select_messages_in_own_or_public_chat" on public.cct_message;
create policy "users_select_messages_in_own_chat"
  on public.cct_message for select
  using (
    exists (
      select 1 from public.cct_chat c
      where c.id = cct_message.chat_id
        and c.user_id = auth.uid()
    )
  );

create policy "users_insert_messages_in_own_chat"
  on public.cct_message for insert
  with check (
    exists (
      select 1 from public.cct_chat c
      where c.id = chat_id and c.user_id = auth.uid()
    )
  );

create policy "users_update_messages_in_own_chat"
  on public.cct_message for update
  using (
    exists (
      select 1 from public.cct_chat c
      where c.id = cct_message.chat_id and c.user_id = auth.uid()
    )
  );

create policy "users_delete_messages_in_own_chat"
  on public.cct_message for delete
  using (
    exists (
      select 1 from public.cct_chat c
      where c.id = cct_message.chat_id and c.user_id = auth.uid()
    )
  );

-- ---------- cct_vote ----------
drop policy if exists "users_select_votes_in_own_or_public_chat" on public.cct_vote;
create policy "users_select_votes_in_own_chat"
  on public.cct_vote for select
  using (
    exists (
      select 1 from public.cct_chat c
      where c.id = cct_vote.chat_id
        and c.user_id = auth.uid()
    )
  );

create policy "users_modify_votes_in_own_chat"
  on public.cct_vote for all
  using (
    exists (
      select 1 from public.cct_chat c
      where c.id = cct_vote.chat_id and c.user_id = auth.uid()
    )
  );

-- ---------- cct_document ----------
create policy "users_select_own_documents"
  on public.cct_document for select
  using (auth.uid() = user_id);

create policy "users_insert_own_documents"
  on public.cct_document for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_documents"
  on public.cct_document for update
  using (auth.uid() = user_id);

create policy "users_delete_own_documents"
  on public.cct_document for delete
  using (auth.uid() = user_id);

-- ---------- cct_suggestion ----------
create policy "users_select_own_suggestions"
  on public.cct_suggestion for select
  using (auth.uid() = user_id);

create policy "users_insert_own_suggestions"
  on public.cct_suggestion for insert
  with check (auth.uid() = user_id);

create policy "users_update_own_suggestions"
  on public.cct_suggestion for update
  using (auth.uid() = user_id);

create policy "users_delete_own_suggestions"
  on public.cct_suggestion for delete
  using (auth.uid() = user_id);
