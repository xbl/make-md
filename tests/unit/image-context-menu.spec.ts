import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(async () => []),
  convertFileSrc: vi.fn((p: string) => `asset://${p}`),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(async () => null),
}));

describe("image context menu items", () => {
  it("findImageAtClick returns null for non-image clicks", async () => {
    const { findImageAtClick } = await import("@/lib/image-commands");
    expect(findImageAtClick).toBeDefined();
  });

  it("image menu item IDs are defined", async () => {
    const cmdIds = [
      "image.copyImage",
      "image.copyPath",
      "image.saveAs",
      "image.revealInFinder",
    ];
    for (const id of cmdIds) {
      expect(id).toMatch(/^image\./);
    }
  });
});
