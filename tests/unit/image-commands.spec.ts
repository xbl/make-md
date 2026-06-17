import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: vi.fn(async () => []),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(async () => null),
}));

describe("image commands", () => {
  it("copyImageMarkdownPath writes to clipboard", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const { copyImageMarkdownPath } = await import("@/lib/image-commands");
    copyImageMarkdownPath({ alt: "cat", src: "cat.png" });
    expect(writeText).toHaveBeenCalledWith("![cat](cat.png)");
  });

  it("resolveImageAbsolutePath returns null for http URLs", async () => {
    const { resolveImageAbsolutePath } = await import("@/lib/image-assets");
    expect(resolveImageAbsolutePath("/doc", "https://example.com/img.png")).toBeNull();
  });

  it("resolveImageAbsolutePath returns absolute for relative paths", async () => {
    const { resolveImageAbsolutePath } = await import("@/lib/image-assets");
    const result = resolveImageAbsolutePath("/doc/note.md", "./assets/img.png");
    expect(result).toBe("/doc/assets/img.png");
  });
});
