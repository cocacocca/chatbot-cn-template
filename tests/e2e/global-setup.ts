import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const TEST_USER = {
  email: "test-e2e@example.com",
  password: "test-password-123",
};

const AUTH_DIR = "tests/e2e/.auth";
const AUTH_FILE = `${AUTH_DIR}/user.json`;

function loadEnvFile(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, "utf-8");
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }
  return env;
}

async function ensureTestUser(supabaseUrl: string, serviceRoleKey: string) {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error } = await adminClient.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
  });

  // User already exists on subsequent runs — expected, safe to ignore
  if (error) {
    console.log(`[global-setup] createUser notice: ${error.message}`);
  }
}

async function ensureTestUserModels(
  supabaseUrl: string,
  serviceRoleKey: string
) {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Look up the test user id
  const {
    data: { users },
    error: listError,
  } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.log(`[global-setup] listUsers notice: ${listError.message}`);
    return;
  }
  const user = users.find((u) => u.email === TEST_USER.email);
  if (!user) {
    console.log("[global-setup] test user not found, skipping model seed");
    return;
  }

  // Seed model configs expected by model-selector.test.ts. The UI uses
  // the model id as the display name (no separate name column), so the
  // ids below must match the test assertions (e.g. "Mistral Small").
  const models = [
    {
      id: "Mistral Small",
      provider: "Mistral",
      base_url: "http://localhost:8000/v1",
      api_key: "test-key",
      capabilities: { tools: true, vision: false, reasoning: false },
      reasoning_effort: null,
      is_default: true,
      is_title_model: false,
      user_id: user.id,
    },
    {
      id: "Kimi",
      provider: "Moonshot",
      base_url: "http://localhost:8000/v1",
      api_key: "test-key",
      capabilities: { tools: true, vision: false, reasoning: false },
      reasoning_effort: null,
      is_default: false,
      is_title_model: false,
      user_id: user.id,
    },
  ];

  // Clean up any existing models for the test user before inserting fresh
  // ones. This avoids duplicate-key errors without relying on a unique
  // constraint for upsert.
  await adminClient.from("cct_model_config").delete().eq("user_id", user.id);

  for (const model of models) {
    const { error: insertError } = await adminClient
      .from("cct_model_config")
      .insert(model);
    if (insertError) {
      console.log(
        `[global-setup] model insert notice (${model.id}): ${insertError.message}`
      );
    }
  }
}

export default async function globalSetup(config: FullConfig) {
  const env = loadEnvFile(resolve(process.cwd(), ".env.local"));
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }

  await ensureTestUser(supabaseUrl, serviceRoleKey);
  await ensureTestUserModels(supabaseUrl, serviceRoleKey);

  // Log in via the real UI so the browser stores the Supabase session cookies
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:30000";
  const browser = await chromium.launch({
    // Bypass the system HTTP proxy so the browser can reach the local dev
    // server directly. Without this, requests to localhost are routed through
    // the proxy and time out.
    args: ["--no-proxy-server"],
  });
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByPlaceholder("you@example.com").fill(TEST_USER.email);
    await page.getByLabel("密码").fill(TEST_USER.password);
    await page.getByRole("button", { name: "登录" }).click();

    // Wait for redirect to the protected home page
    await page.waitForURL("/", { timeout: 30_000 });
    await page.getByTestId("multimodal-input").waitFor({ timeout: 30_000 });

    mkdirSync(resolve(process.cwd(), AUTH_DIR), { recursive: true });
    await context.storageState({ path: resolve(process.cwd(), AUTH_FILE) });
  } finally {
    await browser.close();
  }
}
