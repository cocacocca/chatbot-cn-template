-- cct-chat-attachments bucket（私有 bucket）
insert into storage.buckets (id, name, public)
values ('cct-chat-attachments', 'cct-chat-attachments', false)
on conflict (id) do nothing;

-- 上传：用户只能上传到自己 user_id 前缀的路径
create policy "users_upload_own_attachments"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'cct-chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 读取：用户只能读自己 user_id 前缀的文件
create policy "users_read_own_attachments"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'cct-chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 删除：用户只能删自己 user_id 前缀的文件
create policy "users_delete_own_attachments"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'cct-chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 更新：用户只能更新自己 user_id 前缀的文件
create policy "users_update_own_attachments"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'cct-chat-attachments'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
