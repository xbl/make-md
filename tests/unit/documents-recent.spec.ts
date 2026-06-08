import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDocumentsStore } from "@/stores/documents";

vi.mock("@/lib/file-service", () => ({
  loadRecentFiles: vi.fn(async () => []),
  saveRecentFile: vi.fn(async (path: string) => [path]),
  removeRecentFile: vi.fn(async () => ["b.md"]),
  clearRecentFiles: vi.fn(async () => []),
}));

describe("documents recent actions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("removes one recent file without touching sessions", async () => {
    const store = useDocumentsStore();
    store.recentFiles = ["a.md", "b.md"];
    store.createNewDocument();

    await store.removeRecent("a.md");

    expect(store.recentFiles).toEqual(["b.md"]);
    expect(store.sessions).toHaveLength(1);
  });

  it("clears recent files without touching sessions", async () => {
    const store = useDocumentsStore();
    store.recentFiles = ["a.md", "b.md"];
    store.createNewDocument();

    await store.clearRecent();

    expect(store.recentFiles).toEqual([]);
    expect(store.sessions).toHaveLength(1);
  });
});
