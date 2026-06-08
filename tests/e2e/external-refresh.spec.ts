import { test, expect } from "@playwright/test";

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

test("refreshes an open document after an external file change", async ({ page }) => {
  await page.addInitScript(() => {
    window.__MAKE_MD_E2E__ = {
      files: {
        "/tmp/note.md": "first",
      },
    };
  });

  await page.goto("/");
  await page.evaluate(() => window.__MAKE_MD_APP__?.openFile("/tmp/note.md"));
  await expect(page.locator(".ProseMirror")).toContainText("first");

  await page.evaluate(() => {
    if (!window.__MAKE_MD_E2E__) {
      return;
    }
    window.__MAKE_MD_E2E__.files["/tmp/note.md"] = "second";
    window.dispatchEvent(new CustomEvent("make-md:e2e-workspace-changed"));
  });

  await expect(page.locator(".ProseMirror")).toContainText("second");
});
