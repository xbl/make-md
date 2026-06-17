import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDocumentsStore } from "@/stores/documents";

vi.mock("@/lib/file-service", () => ({
  loadRecentFiles: vi.fn(async () => []),
  pickMarkdownFile: vi.fn(async () => null),
  pickSaveHtmlFile: vi.fn(async () => null),
  pickSaveMarkdownFile: vi.fn(async () => null),
  readMarkdownFile: vi.fn(),
  saveRecentFile: vi.fn(async (path: string) => [path]),
  writeMarkdownFile: vi.fn(async () => {}),
  writeTextFile: vi.fn(async () => {}),
}));

vi.mock("@/lib/file-watch", () => ({
  watchFile: vi.fn(async () => {}),
  unwatchFile: vi.fn(async () => {}),
}));

vi.mock("@/lib/external-change-prompt", () => ({
  promptExternalChange: vi.fn(),
}));

describe("documents handleExternalFileChange", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("reloads silently when the session is clean", async () => {
    const fileService = await import("@/lib/file-service");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
    await store.openFile("/a.md");

    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "new" });
    await store.handleExternalFileChange({ path: "/a.md", kind: "modified" });

    expect(store.activeSession?.content).toBe("new");
  });

  it("prompts when the session is dirty and reloads on 'reload'", async () => {
    const fileService = await import("@/lib/file-service");
    const prompt = await import("@/lib/external-change-prompt");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
    const session = await store.openFile("/a.md");
    session?.updateContent("local");

    vi.mocked(prompt.promptExternalChange).mockResolvedValueOnce("reload");
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "new" });
    await store.handleExternalFileChange({ path: "/a.md", kind: "modified" });

    expect(store.activeSession?.content).toBe("new");
    expect(store.activeSession?.isDirty()).toBe(false);
  });

  it("prompts when dirty and keeps local on 'keep'", async () => {
    const fileService = await import("@/lib/file-service");
    const prompt = await import("@/lib/external-change-prompt");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
    const session = await store.openFile("/a.md");
    session?.updateContent("local");

    vi.mocked(prompt.promptExternalChange).mockResolvedValueOnce("keep");
    await store.handleExternalFileChange({ path: "/a.md", kind: "modified" });

    expect(store.activeSession?.content).toBe("local");
    expect(store.activeSession?.isDirty()).toBe(true);
  });

  it("marks missing on removed event", async () => {
    const fileService = await import("@/lib/file-service");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
    await store.openFile("/a.md");

    await store.handleExternalFileChange({ path: "/a.md", kind: "removed" });

    expect(store.activeSession?.isMissing()).toBe(true);
    expect(store.activeSession?.content).toBe("old");
  });

  it("ignores changes within self-write window", async () => {
    const fileService = await import("@/lib/file-service");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
    await store.openFile("/a.md");

    // Simulate a recent self-write by saving.
    vi.mocked(fileService.writeMarkdownFile).mockResolvedValueOnce(undefined as never);
    await store.saveActiveFile();

    vi.mocked(fileService.readMarkdownFile).mockClear();
    await store.handleExternalFileChange({ path: "/a.md", kind: "modified" });

    expect(fileService.readMarkdownFile).not.toHaveBeenCalled();
  });

  it("processes the change after the self-write window expires", async () => {
    vi.useFakeTimers();
    try {
      const fileService = await import("@/lib/file-service");
      const store = useDocumentsStore();
      vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
      await store.openFile("/a.md");
      vi.mocked(fileService.writeMarkdownFile).mockResolvedValueOnce(undefined as never);
      await store.saveActiveFile();

      vi.advanceTimersByTime(600); // > SELF_WRITE_IGNORE_MS (500)
      vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "new" });
      await store.handleExternalFileChange({ path: "/a.md", kind: "modified" });

      expect(store.activeSession?.content).toBe("new");
    } finally {
      vi.useRealTimers();
    }
  });
});
