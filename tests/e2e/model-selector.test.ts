import { expect, test } from "@playwright/test";

const MODEL_BUTTON_REGEX = /Kimi|Codestral|Mistral|DeepSeek|GPT|Grok/i;

test.describe("Model Selector", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays a model button", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await expect(modelButton).toBeVisible();
  });

  test("opens model selector popover on click", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    await expect(page.getByPlaceholder("搜索模型...")).toBeVisible();
  });

  test("can search for models", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    const searchInput = page.getByPlaceholder("搜索模型...");
    await searchInput.fill("Mistral");

    await expect(page.getByText("Mistral Small").first()).toBeVisible();
  });

  test("can close model selector by clicking outside", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    await expect(page.getByPlaceholder("搜索模型...")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByPlaceholder("搜索模型...")).not.toBeVisible();
  });

  test("shows model provider groups", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    await expect(page.getByText("Mistral", { exact: true })).toBeVisible();
    await expect(page.getByText("Moonshot", { exact: true })).toBeVisible();
  });

  test("can select a different model", async ({ page }) => {
    const modelButton = page
      .locator("button")
      .filter({ hasText: MODEL_BUTTON_REGEX })
      .first();
    await modelButton.click();

    await page.getByText("Mistral Small").first().click();

    await expect(page.getByPlaceholder("搜索模型...")).not.toBeVisible();

    await expect(
      page.locator("button").filter({ hasText: "Mistral Small" }).first()
    ).toBeVisible();
  });
});
