import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FileTreeNode from "@/components/FileTreeNode.vue";
import { useFolderWorkspaceStore } from "@/stores/folder-workspace";

vi.mock("@/lib/workspace-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/workspace-service")>("@/lib/workspace-service");
  return {
    ...actual,
    createWorkspaceFile: vi.fn(),
    deleteWorkspaceFile: vi.fn(),
    moveWorkspaceFile: vi.fn(),
    renameWorkspaceFile: vi.fn(),
    revealInFinder: vi.fn(),
  };
});

const workspaceService = await import("@/lib/workspace-service");

describe("FileTreeNode", () => {
  function actionLabels(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll("button.context-menu__item").map((button) => button.text());
  }

  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  it("selects the file path and shows the full file menu on right click", async () => {
    const wrapper = mount(FileTreeNode, {
      attachTo: document.body,
      props: {
        node: {
          name: "notes.md",
          path: "/tmp/notes.md",
          kind: "file",
          children: [],
        },
        depth: 0,
      },
    });
    const folderWorkspace = useFolderWorkspaceStore();

    await wrapper.get(".file-tree__row--file").trigger("contextmenu", {
      clientX: 120,
      clientY: 64,
    });

    expect(folderWorkspace.selectedPath).toBe("/tmp/notes.md");
    expect(wrapper.get(".context-menu").attributes("style")).toContain("left: 120px");
    expect(actionLabels(wrapper)).toEqual(["Open", "Rename", "Delete", "Reveal in Finder"]);
  });

  it("shows the folder menu contents on right click", async () => {
    const wrapper = mount(FileTreeNode, {
      attachTo: document.body,
      props: {
        node: {
          name: "docs",
          path: "/tmp/docs",
          kind: "folder",
          children: [],
        },
        depth: 0,
      },
    });
    const folderWorkspace = useFolderWorkspaceStore();

    await wrapper.get(".file-tree__row").trigger("contextmenu", {
      clientX: 44,
      clientY: 28,
    });

    expect(folderWorkspace.selectedPath).toBe("/tmp/docs");
    expect(actionLabels(wrapper)).toEqual(["New File", "Reveal in Finder"]);
  });

  it("creates a new file from the shared folder menu after prompt acceptance", async () => {
    vi.mocked(workspaceService.createWorkspaceFile).mockResolvedValue("/tmp/docs/draft.md");
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue("draft");
    const wrapper = mount(FileTreeNode, {
      attachTo: document.body,
      props: {
        node: {
          name: "docs",
          path: "/tmp/docs",
          kind: "folder",
          children: [],
        },
        depth: 0,
      },
    });

    await wrapper.get(".file-tree__row").trigger("contextmenu", {
      clientX: 40,
      clientY: 24,
    });
    const newFileButton = wrapper
      .findAll("button.context-menu__item")
      .find((button) => button.text().includes("New File"));

    expect(newFileButton).toBeDefined();
    await newFileButton!.trigger("click");
    await nextTick();

    expect(promptSpy).toHaveBeenCalledWith("New file name", "Untitled");
    expect(workspaceService.createWorkspaceFile).toHaveBeenCalledWith("/tmp/docs", "draft");
    expect(wrapper.emitted("open-file")).toEqual([["/tmp/docs/draft.md"]]);
    expect(wrapper.find(".context-menu").exists()).toBe(false);
  });

  it("wires open from the shared file menu", async () => {
    const wrapper = mount(FileTreeNode, {
      attachTo: document.body,
      props: {
        node: {
          name: "notes.md",
          path: "/tmp/notes.md",
          kind: "file",
          children: [],
        },
        depth: 0,
      },
    });

    await wrapper.get(".file-tree__row--file").trigger("contextmenu", {
      clientX: 80,
      clientY: 32,
    });
    const openButton = wrapper
      .findAll("button.context-menu__item")
      .find((button) => button.text().includes("Open"));

    expect(openButton).toBeDefined();
    await openButton!.trigger("click");

    expect(wrapper.emitted("open-file")).toEqual([["/tmp/notes.md"]]);
    expect(wrapper.find(".context-menu").exists()).toBe(false);
  });

  it("wires reveal in finder from the shared context menu", async () => {
    const wrapper = mount(FileTreeNode, {
      attachTo: document.body,
      props: {
        node: {
          name: "notes.md",
          path: "/tmp/notes.md",
          kind: "file",
          children: [],
        },
        depth: 0,
      },
    });

    await wrapper.get(".file-tree__row--file").trigger("contextmenu", {
      clientX: 80,
      clientY: 32,
    });
    const revealButton = wrapper
      .findAll("button.context-menu__item")
      .find((button) => button.text().includes("Reveal in Finder"));

    expect(revealButton).toBeDefined();
    await revealButton!.trigger("click");

    expect(workspaceService.revealInFinder).toHaveBeenCalledWith("/tmp/notes.md");
    expect(wrapper.find(".context-menu").exists()).toBe(false);
  });
});
