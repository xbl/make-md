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

describe("documents external refresh", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("refreshes an open clean session when the file changes externally", async () => {
    const fileService = await import("@/lib/file-service");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockReset();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/tmp/note.md", content: "first" });
    await store.openFile("/tmp/note.md");

    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/tmp/note.md", content: "second" });
    await store.refreshSessionFromDisk("/tmp/note.md");

    expect(store.activeSession?.content).toBe("second");
    expect(store.activeSession?.isDirty()).toBe(false);
  });

  it("does not overwrite a dirty open session when the file changes externally", async () => {
    const fileService = await import("@/lib/file-service");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockReset();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/tmp/note.md", content: "first" });
    const session = await store.openFile("/tmp/note.md");
    session?.updateContent("local edits");

    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/tmp/note.md", content: "second" });
    await store.refreshSessionFromDisk("/tmp/note.md");

    expect(store.activeSession?.content).toBe("local edits");
    expect(store.activeSession?.isDirty()).toBe(true);
  });
});
