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

test("reproduces syntax highlight visibility for a temporary markdown file", async ({ page }) => {
  const filePath = "/tmp/make-md-highlight-repro.md";
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

  await expect(page.locator(".code-block-wrapper")).toHaveCount(3);

  const tsBlock = page.locator(".code-block-wrapper").nth(0);
  const jsonBlock = page.locator(".code-block-wrapper").nth(1);
  const mermaidBlock = page.locator(".code-block-wrapper").nth(2);
  const mermaidPreview = page.locator(".mermaid-preview").first();

  await page.waitForTimeout(1000);

  await expect(tsBlock).toHaveAttribute("data-language", "ts");
  await expect(jsonBlock).toHaveAttribute("data-language", "json");
  await expect(tsBlock).toHaveAttribute("data-highlighted", "true");
  await expect(jsonBlock).toHaveAttribute("data-highlighted", "true");
  await expect(tsBlock.locator(".hljs-overlay code.hljs")).toBeVisible();
  await expect(jsonBlock.locator(".hljs-overlay code.hljs")).toBeVisible();
  await expect(mermaidPreview).toHaveClass(/mermaid-preview--ready/);

  await tsBlock.screenshot({ path: "output/playwright/repro-ts-block.png" });
  await jsonBlock.screenshot({ path: "output/playwright/repro-json-block.png" });
  await mermaidBlock.screenshot({ path: "output/playwright/repro-mermaid-block.png" });
});
