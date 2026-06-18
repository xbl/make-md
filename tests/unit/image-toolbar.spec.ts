import { describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => false,
  invoke: vi.fn(async () => []),
  convertFileSrc: vi.fn((p: string) => `asset://${p}`),
}));

describe("image toolbar plugin", () => {
  it("plugin key is defined", async () => {
    const { imageToolbarKey } = await import("@/editor/image-toolbar-plugin");
    expect(imageToolbarKey).toBeDefined();
    expect(imageToolbarKey.key).toBe("imageToolbar$");
  });

  it("createImageToolbarPlugin returns a Plugin", async () => {
    const { createImageToolbarPlugin } = await import("@/editor/image-toolbar-plugin");
    const plugin = createImageToolbarPlugin();
    expect(plugin).toBeDefined();
    expect(plugin.props).toBeDefined();
  });
});
