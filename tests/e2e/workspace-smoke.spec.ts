import { test, expect } from "@playwright/test";

test("renders editor shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("editor-pane")).toBeVisible();
});
