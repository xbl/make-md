import { test, expect } from "@playwright/test";
import fs from "node:fs";

declare global {
  interface Window {
    __MAKE_MD_APP__?: {
      openFile: (path: string) => Promise<unknown>;
    };
    __MAKE_MD_E2E__?: {
      files: Record<string, string>;
    };
  }
}

test("captures code block highlighting for the SDSP design markdown", async ({ page }) => {
  const filePath = "/Users/blxie/Documents/项目/上海银行/二期/Markdown 文档/概要设计/SDSP 领域-概要设计.md";
  const content = fs.readFileSync(filePath, "utf8");

  await page.addInitScript(({ path, markdown }) => {
    window.__MAKE_MD_E2E__ = {
      files: {
        [path]: markdown,
      },
    };
  }, { path: filePath, markdown: content });

  await page.goto("/");
  await page.evaluate(async (path) => {
    await window.__MAKE_MD_APP__?.openFile(path);
  }, filePath);

  await expect(page.locator(".code-block-wrapper")).toHaveCount(6);
  await expect(page.locator(".code-block-language-trigger").first()).toHaveText("mermaid");

  const firstMermaid = page.locator(".code-block-wrapper").first();
  const firstMermaidPreview = page.locator(".mermaid-preview").first();
  await firstMermaid.scrollIntoViewIfNeeded();
  await expect(firstMermaidPreview).toBeVisible();
  await expect(firstMermaidPreview).toHaveClass(/mermaid-preview--ready/);

  await firstMermaidPreview.screenshot({
    path: "output/playwright/real-sdsp-first-mermaid-preview.png",
  });
});
