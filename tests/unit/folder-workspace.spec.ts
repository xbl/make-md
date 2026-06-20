import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useFolderWorkspaceStore } from "../../src/stores/folder-workspace";
import { useUiStore } from "../../src/stores/ui";

vi.mock("@/lib/workspace-service", () => ({
  listMarkdownTree: vi.fn(async () => ({
    name: "test",
    path: "/tmp/test",
    kind: "folder" as const,
    children: [],
  })),
  startFolderWatch: vi.fn(async () => {}),
  stopFolderWatch: vi.fn(),
}));

describe("folder workspace store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("tracks expanded folder paths", () => {
    const store = useFolderWorkspaceStore();
    expect(store.isExpanded("/tmp/root")).toBe(false);
    store.toggleExpanded("/tmp/root");
    expect(store.isExpanded("/tmp/root")).toBe(true);
  });

  it("finds file node by path in tree", () => {
    const store = useFolderWorkspaceStore();
    store.tree = {
      name: "root",
      path: "/tmp/root",
      kind: "folder",
      children: [
        { name: "a.md", path: "/tmp/root/a.md", kind: "file", children: [] },
      ],
    };
    expect(store.findNode("/tmp/root/a.md")?.name).toBe("a.md");
  });

  it("shows sidebar when setRootPath is called", async () => {
    const folderStore = useFolderWorkspaceStore();
    const uiStore = useUiStore();

    expect(uiStore.sidebarCollapsed).toBe(true);

    await folderStore.setRootPath("/tmp/test");

    expect(uiStore.sidebarCollapsed).toBe(false);
    expect(folderStore.rootPath).toBe("/tmp/test");
  });

  it("shows the sidebar when switching to a sidebar tab", () => {
    const folderStore = useFolderWorkspaceStore();
    const uiStore = useUiStore();

    uiStore.sidebarCollapsed = true;
    folderStore.showSidebarTab("outline");

    expect(uiStore.sidebarCollapsed).toBe(false);
    expect(folderStore.activeTab).toBe("outline");
  });
});
