import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TabStrip from "@/components/TabStrip.vue";
import { createDocumentSession } from "@/lib/document-session";
import { useDocumentsStore } from "@/stores/documents";

vi.mock("@/lib/unsaved-prompt", () => ({
  promptUnsavedChanges: vi.fn(),
}));

vi.mock("@/lib/workspace-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/workspace-service")>("@/lib/workspace-service");
  return {
    ...actual,
    revealInFinder: vi.fn(),
  };
});

const unsavedPrompt = await import("@/lib/unsaved-prompt");
const workspaceService = await import("@/lib/workspace-service");

describe("TabStrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
  });

  function seedSessions() {
    const documents = useDocumentsStore();
    const first = createDocumentSession({
      id: "/tmp/first.md",
      path: "/tmp/first.md",
      content: "# First",
    });
    const second = createDocumentSession({
      id: "/tmp/second.md",
      path: "/tmp/second.md",
      content: "# Second",
    });
    const untitled = createDocumentSession({
      id: "untitled-1",
      path: "",
      content: "",
    });

    documents.openSession(first);
    documents.openSession(second);
    documents.openSession(untitled);
    return documents;
  }

  function actionButtons(wrapper: ReturnType<typeof mount>) {
    return wrapper.findAll("button.context-menu__item");
  }

  function actionButton(wrapper: ReturnType<typeof mount>, label: string) {
    return actionButtons(wrapper).find((button) => button.text() === label);
  }

  it("opens the shared context menu on right click for a tab", async () => {
    seedSessions();
    const wrapper = mount(TabStrip, {
      attachTo: document.body,
    });

    await wrapper.findAll(".tab-group")[1]!.trigger("contextmenu", {
      clientX: 140,
      clientY: 72,
    });

    expect(wrapper.get(".context-menu").attributes("style")).toContain("left: 140px");
    expect(actionButtons(wrapper).map((button) => button.text())).toEqual([
      "Close",
      "Close Others",
      "Reveal in Finder",
    ]);
  });

  it("runs the tab-menu Close action for the selected tab", async () => {
    const documents = seedSessions();
    const wrapper = mount(TabStrip, {
      attachTo: document.body,
    });

    await wrapper.findAll(".tab-group")[1]!.trigger("contextmenu", {
      clientX: 88,
      clientY: 44,
    });

    const closeButton = actionButton(wrapper, "Close");
    expect(closeButton).toBeDefined();

    await closeButton!.trigger("click");

    expect(documents.sessions.map((session) => session.id)).toEqual(["/tmp/first.md", "untitled-1"]);
    expect(documents.activeSessionId).toBe("untitled-1");
    expect(wrapper.find(".context-menu").exists()).toBe(false);
  });

  it("closes all other sessions from Close Others while keeping the target tab", async () => {
    const documents = seedSessions();
    const wrapper = mount(TabStrip, {
      attachTo: document.body,
    });

    await wrapper.findAll(".tab-group")[1]!.trigger("contextmenu", {
      clientX: 90,
      clientY: 50,
    });

    const closeOthersButton = actionButton(wrapper, "Close Others");
    expect(closeOthersButton).toBeDefined();

    await closeOthersButton!.trigger("click");

    expect(documents.sessions.map((session) => session.id)).toEqual(["/tmp/second.md"]);
    expect(documents.activeSessionId).toBe("/tmp/second.md");
    expect(wrapper.find(".context-menu").exists()).toBe(false);
  });

  it("keeps the target tab active when Close Others is cancelled by a dirty sibling", async () => {
    const documents = seedSessions();
    documents.sessions[0]?.markDirty();
    vi.mocked(unsavedPrompt.promptUnsavedChanges).mockResolvedValue("cancel");

    const wrapper = mount(TabStrip, {
      attachTo: document.body,
    });

    await wrapper.findAll(".tab-group")[1]!.trigger("contextmenu", {
      clientX: 92,
      clientY: 40,
    });

    const closeOthersButton = actionButton(wrapper, "Close Others");
    expect(closeOthersButton).toBeDefined();

    await closeOthersButton!.trigger("click");
    await vi.waitFor(() => {
      expect(documents.activeSessionId).toBe("/tmp/second.md");
    });

    expect(unsavedPrompt.promptUnsavedChanges).toHaveBeenCalledWith("first.md");
    expect(documents.sessions.map((session) => session.id)).toEqual([
      "/tmp/first.md",
      "/tmp/second.md",
      "untitled-1",
    ]);
    expect(wrapper.find(".context-menu").exists()).toBe(false);
  });

  it("disables Close Others when only one tab exists", async () => {
    const documents = useDocumentsStore();
    documents.openSession(
      createDocumentSession({
        id: "/tmp/solo.md",
        path: "/tmp/solo.md",
        content: "# Solo",
      }),
    );
    const wrapper = mount(TabStrip, {
      attachTo: document.body,
    });

    await wrapper.find(".tab-group").trigger("contextmenu", {
      clientX: 60,
      clientY: 32,
    });

    const closeOthersButton = actionButton(wrapper, "Close Others");
    expect(closeOthersButton).toBeDefined();
    expect(closeOthersButton!.attributes("disabled")).toBeDefined();
  });

  it("disables Reveal in Finder for an untitled tab and enables it for a file-backed tab", async () => {
    seedSessions();
    const wrapper = mount(TabStrip, {
      attachTo: document.body,
    });

    await wrapper.findAll(".tab-group")[2]!.trigger("contextmenu", {
      clientX: 84,
      clientY: 36,
    });

    const untitledRevealButton = actionButtons(wrapper).find((button) => button.text().includes("Reveal in Finder"));
    expect(untitledRevealButton).toBeDefined();
    expect(untitledRevealButton!.attributes("disabled")).toBeDefined();

    await wrapper.findAll(".tab-group")[0]!.trigger("contextmenu", {
      clientX: 48,
      clientY: 24,
    });

    const revealButton = actionButtons(wrapper).find((button) => button.text().includes("Reveal in Finder"));
    expect(revealButton).toBeDefined();
    expect(revealButton!.attributes("disabled")).toBeUndefined();

    await revealButton!.trigger("click");

    expect(workspaceService.revealInFinder).toHaveBeenCalledWith("/tmp/first.md");
    expect(wrapper.find(".context-menu").exists()).toBe(false);
  });
});
