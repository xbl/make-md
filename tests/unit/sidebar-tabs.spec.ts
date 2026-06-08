import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SidebarTabs from "@/components/SidebarTabs.vue";
import { revealInFinder } from "@/lib/workspace-service";
import { useDocumentsStore } from "@/stores/documents";
import { useFolderWorkspaceStore } from "@/stores/folder-workspace";

vi.mock("@/lib/workspace-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/workspace-service")>("@/lib/workspace-service");
  return {
    ...actual,
    listMarkdownTree: vi.fn(async () => ({ name: "root", path: "/tmp", kind: "folder", children: [] })),
    startFolderWatch: vi.fn(async () => {}),
    stopFolderWatch: vi.fn(),
    revealInFinder: vi.fn(),
  };
});

describe("SidebarTabs recent actions", () => {
  function mountRecentTabs() {
    const wrapper = mount(SidebarTabs, {
      attachTo: document.body,
    });
    const folderWorkspace = useFolderWorkspaceStore();
    folderWorkspace.setActiveTab("files");
    return wrapper;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
    setActivePinia(createPinia());
  });

  it("shows the shared recent-item menu on right click when no folder is open", async () => {
    const documents = useDocumentsStore();
    documents.recentFiles = ["/tmp/notes.md"];
    const wrapper = mountRecentTabs();

    await wrapper.get(".nav-item").trigger("contextmenu", {
      clientX: 120,
      clientY: 64,
    });

    expect(wrapper.get(".context-menu").attributes("style")).toContain("left: 120px");
    expect(wrapper.findAll("button.context-menu__item").map((button) => button.text())).toEqual([
      "Open",
      "Remove from Recent",
      "Reveal in Finder",
    ]);
  });

  it("removes a recent item from the shared context menu", async () => {
    const documents = useDocumentsStore();
    documents.recentFiles = ["/tmp/notes.md"];
    documents.removeRecent = vi.fn(async () => {});
    const wrapper = mountRecentTabs();

    await wrapper.get(".nav-item").trigger("contextmenu", {
      clientX: 100,
      clientY: 40,
    });
    const removeButton = wrapper
      .findAll("button.context-menu__item")
      .find((button) => button.text().includes("Remove from Recent"));

    expect(removeButton).toBeDefined();
    await removeButton!.trigger("click");
    await nextTick();

    expect(documents.removeRecent).toHaveBeenCalledWith("/tmp/notes.md");
    expect(wrapper.find(".context-menu").exists()).toBe(false);
  });

  it("reveals a recent item in finder from the shared context menu", async () => {
    const documents = useDocumentsStore();
    documents.recentFiles = ["/tmp/notes.md"];
    const wrapper = mountRecentTabs();

    await wrapper.get(".nav-item").trigger("contextmenu", {
      clientX: 100,
      clientY: 40,
    });
    const revealButton = wrapper
      .findAll("button.context-menu__item")
      .find((button) => button.text().includes("Reveal in Finder"));

    expect(revealButton).toBeDefined();
    await revealButton!.trigger("click");
    await nextTick();

    expect(revealInFinder).toHaveBeenCalledWith("/tmp/notes.md");
    expect(wrapper.find(".context-menu").exists()).toBe(false);
  });

  it("clears recent files from the header action when no folder is open", async () => {
    const documents = useDocumentsStore();
    documents.recentFiles = ["/tmp/notes.md"];
    documents.clearRecent = vi.fn(async () => {});
    const wrapper = mountRecentTabs();

    await wrapper.get("[data-testid='recent-clear']").trigger("click");

    expect(documents.clearRecent).toHaveBeenCalledTimes(1);
  });
});
