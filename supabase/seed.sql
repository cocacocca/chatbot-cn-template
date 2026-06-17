-- 默认模型配置（DeepSeek V3.2）
insert into public.cct_model_config (id, provider, base_url, api_key, capabilities, reasoning_effort, is_default, is_title_model)
values (
  'deepseek-v3.2',
  'DeepSeek',
  'https://api.deepseek.com/v1',
  '',
  '{"chat": true, "reasoning": false, "vision": false}'::json,
  null,
  true,
  true
)
on conflict (id) do nothing;
