import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useFolderWorkspaceStore } from "../../src/stores/folder-workspace";

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
});
