CREATE TABLE IF NOT EXISTS "ModelConfig" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "provider" text NOT NULL DEFAULT 'openai',
  "baseUrl" text,
  "apiKey" text,
  "capabilities" json NOT NULL DEFAULT '{"tools":true,"vision":false,"reasoning":false}',
  "reasoningEffort" text,
  "isDefault" boolean NOT NULL DEFAULT false,
  "isTitleModel" boolean NOT NULL DEFAULT false,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

INSERT INTO "ModelConfig" ("id", "name", "provider", "capabilities", "isDefault", "isTitleModel") VALUES
  ('deepseek/deepseek-v3.2', 'DeepSeek V3.2', 'deepseek', '{"tools":true,"vision":false,"reasoning":false}', true, true);
