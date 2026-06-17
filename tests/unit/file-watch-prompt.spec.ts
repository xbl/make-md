import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
}));

describe("promptExternalChange", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'reload' when user accepts the first prompt", async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    vi.mocked(dialog.ask).mockResolvedValueOnce(true);

    const { promptExternalChange } = await import("@/lib/external-change-prompt");
    const action = await promptExternalChange("note.md");

    expect(action).toBe("reload");
    expect(dialog.ask).toHaveBeenCalledTimes(1);
  });

  it("returns 'keep' when user declines reload but accepts keep", async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    vi.mocked(dialog.ask)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const { promptExternalChange } = await import("@/lib/external-change-prompt");
    const action = await promptExternalChange("note.md");

    expect(action).toBe("keep");
    expect(dialog.ask).toHaveBeenCalledTimes(2);
  });

  it("returns 'cancel' when user declines both prompts", async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    vi.mocked(dialog.ask)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);

    const { promptExternalChange } = await import("@/lib/external-change-prompt");
    const action = await promptExternalChange("note.md");

    expect(action).toBe("cancel");
  });
});
