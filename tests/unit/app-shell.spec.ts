import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "../../src/stores/editor";
import AppShell from "../../src/layout/AppShell.vue";
import { useDocumentsStore } from "../../src/stores/documents";
import { useUiStore } from "../../src/stores/ui";
import { usePreferencesStore } from "../../src/stores/preferences";

const tauriMocks = vi.hoisted(() => {
  const onCloseRequested = vi.fn(async () => () => {});
  const onDragDropEvent = vi.fn(async () => () => {});
  const invoke = vi.fn(async (command: string) => {
    if (command === "load_recent_files") {
      return [];
    }
    return undefined;
  });
  return {
    isTauri: vi.fn(() => false),
    getCurrentWindow: vi.fn(() => ({
      onCloseRequested,
      onDragDropEvent,
    })),
    invoke,
    onCloseRequested,
    onDragDropEvent,
  };
});

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: tauriMocks.isTauri,
  invoke: tauriMocks.invoke,
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: tauriMocks.getCurrentWindow,
}));

vi.mock("@/lib/menu-bridge", () => ({
  startMenuBridge: vi.fn(async () => () => {}),
}));

vi.mock("@/lib/file-watch", () => ({
  watchFile: vi.fn(async () => {}),
  unwatchFile: vi.fn(async () => {}),
  onFileChanged: vi.fn(async () => () => {}),
}));

vi.mock("@/lib/workspace-service", () => ({
  listMarkdownTree: vi.fn(async () => ({ name: "root", path: "/tmp", kind: "folder", children: [] })),
  startFolderWatch: vi.fn(async () => {}),
  stopFolderWatch: vi.fn(),
  onWorkspaceChanged: vi.fn(async () => () => {}),
}));

vi.mock("@/lib/system-locale", () => ({
  loadSystemLocale: vi.fn(async () => "zh-Hans-CN"),
  syncMenuLocale: vi.fn(async () => {}),
}));

describe("AppShell", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    tauriMocks.isTauri.mockReturnValue(false);
    tauriMocks.invoke.mockImplementation(async (command: string) => {
      if (command === "load_recent_files") {
        return [];
      }
      return undefined;
    });
    tauriMocks.onCloseRequested.mockImplementation(async () => () => {});
    tauriMocks.onDragDropEvent.mockImplementation(async () => () => {});
    document.body.innerHTML = "";
  });

  it("renders sidebar, editor pane, and status bar regions", () => {
    const wrapper = mount(AppShell, {
      global: {
        plugins: [createPinia()],
      },
    });

    expect(wrapper.find("[data-testid='sidebar']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='editor-pane']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='status-bar']").exists()).toBe(true);
  });

  it("initializes locale preferences on mount", async () => {
    const wrapper = mount(AppShell, {
      global: {
        plugins: [createPinia()],
      },
    });

    await nextTick();
    await Promise.resolve();

    const preferences = usePreferencesStore();
    expect(preferences.systemLocale).toBe("zh-Hans-CN");
    expect(preferences.effectiveLocale).toBe("zh-CN");
    expect(wrapper.text()).toContain("最近文件");
  });

  it("does not close settings while shortcut capture handles Escape", async () => {
    const handlers: Array<(event: KeyboardEvent) => void | Promise<void>> = [];
    const addSpy = vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (type === "keydown" && typeof listener === "function") {
        handlers.push(listener as (event: KeyboardEvent) => void | Promise<void>);
      }
    });
    const removeSpy = vi.spyOn(window, "removeEventListener").mockImplementation(() => {});

    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();

    const wrapper = mount(AppShell, {
      global: {
        plugins: [pinia],
      },
    });

    ui.openSettings("shortcuts");
    await nextTick();

    const recordButton = wrapper.find("[data-command-id='format.bold'] .settings-panel__capture");
    await recordButton.trigger("click");
    expect(ui.settingsShortcutRecording).toBe(true);

    await recordButton.trigger("keydown", { key: "Escape" });
    await nextTick();

    expect(ui.settingsShortcutRecording).toBe(false);
    expect(ui.settingsOpen).toBe(true);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("closes the command palette on global Escape", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();
    ui.openCommandPalette();

    mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await nextTick();
    expect(ui.commandPaletteOpen).toBe(false);
  });

  it("does not prevent default for system reserved shortcuts like Cmd+C", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    const event = new KeyboardEvent("keydown", { key: "c", metaKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    await nextTick();

    expect(event.defaultPrevented).toBe(false);
  });

  it("toggles source mode when the view.source command is dispatched", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();
    let runCommand: ((commandId: string) => void | Promise<void>) | undefined;
    const menuBridge = await import("@/lib/menu-bridge");
    vi.mocked(menuBridge.startMenuBridge).mockImplementationOnce(async (handler) => {
      runCommand = handler;
      return () => {};
    });

    mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await runCommand?.("view.source");
    await nextTick();
    expect(ui.sourceMode).toBe(true);

    await runCommand?.("view.source");
    await nextTick();
    expect(ui.sourceMode).toBe(false);
  });

  it("opens the editor context menu from AppShell with the full required item set", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    documents.createNewDocument();

    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await nextTick();

    const editor = wrapper.find(".editor-view");
    expect(editor.exists()).toBe(true);

    await editor.trigger("contextmenu", {
      clientX: 160,
      clientY: 120,
      button: 2,
    });
    await nextTick();

    const menu = document.body.querySelector(".context-menu");
    expect(menu).not.toBeNull();
    const labels = Array.from(document.body.querySelectorAll(".context-menu__item .context-menu__label")).map((node) =>
      node.textContent?.trim(),
    );
    expect(labels).toEqual([
      "Cut",
      "Copy",
      "Paste",
      "Select All",
      "Bold",
      "Italic",
      "Inline Code",
      "Heading 1",
      "Heading 2",
      "Heading 3",
      "Paragraph",
      "Insert Table",
    ]);
  });

  it("routes Insert Table through the existing editor command dispatch path", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    documents.createNewDocument();
    const eventSpy = vi.fn();
    const promptSpy = vi.spyOn(window, "prompt").mockReturnValue(null);
    window.addEventListener("make-md:editor-command", eventSpy as EventListener);

    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await nextTick();

    const editor = wrapper.find(".editor-view");
    await editor.trigger("contextmenu", {
      clientX: 160,
      clientY: 120,
      button: 2,
    });
    await nextTick();

    const insertTable = wrapper.findAll(".context-menu__item").find((item) =>
      item.find(".context-menu__label").text() === "Insert Table",
    );
    expect(insertTable).toBeDefined();

    await insertTable!.trigger("click");
    await nextTick();

    expect(eventSpy).toHaveBeenCalled();
    const commandEvents = eventSpy.mock.calls
      .map(([event]) => event as CustomEvent<{ commandId?: string }>)
      .filter((event) => event.type === "make-md:editor-command");
    expect(commandEvents.at(-1)?.detail?.commandId).toBe("paragraph.table");

    promptSpy.mockRestore();
    window.removeEventListener("make-md:editor-command", eventSpy as EventListener);
  });

  it("pastes structured markdown through the existing paste handler from the editor context menu", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    const editorStore = useEditorStore();
    documents.createNewDocument();

    const readText = vi.fn(async () => '```json\n{\n  "a": 1\n}\n```');
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        readText,
        writeText: vi.fn(),
      },
    });

    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await nextTick();

    const editor = wrapper.find(".editor-view");
    await editor.trigger("contextmenu", {
      clientX: 160,
      clientY: 120,
      button: 2,
    });
    await nextTick();

    const paste = wrapper.findAll(".context-menu__item").find((item) =>
      item.find(".context-menu__label").text() === "Paste",
    );
    expect(paste).toBeDefined();

    await paste!.trigger("click");
    await nextTick();

    expect(readText).toHaveBeenCalledTimes(1);
    expect(editorStore.view?.state.doc.childCount).toBe(1);
    expect(editorStore.view?.state.doc.firstChild?.type.name).toBe("code_block");
    expect(editorStore.view?.state.doc.firstChild?.attrs.params).toBe("json");
    expect(editorStore.view?.state.doc.firstChild?.textContent).toContain('"a": 1');
  });

  it("shows and hides the drag overlay only for markdown drags", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    const shell = wrapper.find(".app-shell");
    expect(wrapper.find("[data-testid='markdown-drop-overlay']").exists()).toBe(false);

    await shell.trigger("dragenter", {
      dataTransfer: {
        files: [{ name: "notes.txt", path: "/tmp/notes.txt" }],
      },
    });
    await nextTick();
    expect(wrapper.find("[data-testid='markdown-drop-overlay']").exists()).toBe(false);

    await shell.trigger("dragenter", {
      dataTransfer: {
        files: [{ name: "notes.md", path: "/tmp/notes.md" }],
      },
    });
    await nextTick();
    expect(wrapper.find("[data-testid='markdown-drop-overlay']").exists()).toBe(true);

    await shell.trigger("dragleave", {
      currentTarget: shell.element,
      relatedTarget: wrapper.find(".app-shell__main").element,
      dataTransfer: {
        files: [{ name: "notes.md", path: "/tmp/notes.md" }],
      },
    });
    await nextTick();
    expect(wrapper.find("[data-testid='markdown-drop-overlay']").exists()).toBe(true);

    await shell.trigger("dragleave", {
      currentTarget: shell.element,
      relatedTarget: null,
      dataTransfer: {
        files: [{ name: "notes.md", path: "/tmp/notes.md" }],
      },
    });
    await nextTick();
    expect(wrapper.find("[data-testid='markdown-drop-overlay']").exists()).toBe(false);
  });

  it("only prevents dragover default for markdown drags", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);

    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    const shell = wrapper.find(".app-shell");
    const markdownDragOver = new Event("dragover", {
      bubbles: true,
      cancelable: true,
    }) as Event & {
      dataTransfer: { files: Array<{ name: string; path: string }>; dropEffect?: string };
    };
    markdownDragOver.dataTransfer = {
      files: [{ name: "notes.md", path: "/tmp/notes.md" }],
    };
    shell.element.dispatchEvent(markdownDragOver);
    await nextTick();

    const textDragOver = new Event("dragover", {
      bubbles: true,
      cancelable: true,
    }) as Event & {
      dataTransfer: { files: Array<{ name: string; path: string }>; dropEffect?: string };
    };
    textDragOver.dataTransfer = {
      files: [{ name: "notes.txt", path: "/tmp/notes.txt" }],
    };
    shell.element.dispatchEvent(textDragOver);
    await nextTick();

    expect(markdownDragOver.defaultPrevented).toBe(true);
    expect(textDragOver.defaultPrevented).toBe(false);
  });

  it("opens only markdown files from a mixed drop", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    const openFileSpy = vi.spyOn(documents, "openFile").mockResolvedValue();

    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    const shell = wrapper.find(".app-shell");
    await shell.trigger("drop", {
      dataTransfer: {
        files: [
          { name: "alpha.md", path: "/tmp/alpha.md" },
          { name: "ignore.txt", path: "/tmp/ignore.txt" },
          { name: "beta.markdown", path: "/tmp/beta.markdown" },
        ],
      },
    });
    await nextTick();

    expect(openFileSpy).toHaveBeenCalledTimes(2);
    expect(openFileSpy).toHaveBeenNthCalledWith(1, "/tmp/alpha.md");
    expect(openFileSpy).toHaveBeenNthCalledWith(2, "/tmp/beta.markdown");
    expect(wrapper.find("[data-testid='markdown-drop-overlay']").exists()).toBe(false);
  });

  it("continues opening later markdown files when one drop target fails", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    const openFileSpy = vi
      .spyOn(documents, "openFile")
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue(undefined);

    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    const shell = wrapper.find(".app-shell");
    await shell.trigger("drop", {
      dataTransfer: {
        files: [
          { name: "alpha.md", path: "/tmp/alpha.md" },
          { name: "beta.markdown", path: "/tmp/beta.markdown" },
        ],
      },
    });
    await nextTick();

    expect(openFileSpy).toHaveBeenCalledTimes(2);
    expect(openFileSpy).toHaveBeenNthCalledWith(1, "/tmp/alpha.md");
    expect(openFileSpy).toHaveBeenNthCalledWith(2, "/tmp/beta.markdown");
  });

  it("ignores non-markdown drops", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    const openFileSpy = vi.spyOn(documents, "openFile").mockResolvedValue();
    const preventDefault = vi.fn();

    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    const shell = wrapper.find(".app-shell");
    await shell.trigger("drop", {
      preventDefault,
      dataTransfer: {
        files: [
          { name: "alpha.txt", path: "/tmp/alpha.txt" },
          { name: "beta.png", path: "/tmp/beta.png" },
        ],
      },
    });
    await nextTick();

    expect(openFileSpy).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
    expect(wrapper.find("[data-testid='markdown-drop-overlay']").exists()).toBe(false);
  });

  it("opens dropped markdown files from the Tauri drag-drop payload", async () => {
    tauriMocks.isTauri.mockReturnValue(true);

    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    const openFileSpy = vi.spyOn(documents, "openFile").mockResolvedValue();
    let dragHandler:
      | ((event: { payload: { type: "enter" | "leave" | "over" | "drop"; paths?: string[] } }) => unknown)
      | undefined;

    tauriMocks.onDragDropEvent.mockImplementationOnce(async (handler) => {
      dragHandler = handler;
      return () => {};
    });

    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await nextTick();
    await dragHandler?.({
      payload: {
        type: "enter",
        paths: ["/tmp/alpha.md", "/tmp/ignore.txt"],
      },
    });
    await nextTick();

    expect(wrapper.find("[data-testid='markdown-drop-overlay']").exists()).toBe(true);

    await dragHandler?.({
      payload: {
        type: "drop",
        paths: ["/tmp/alpha.md", "/tmp/ignore.txt", "/tmp/beta.markdown"],
      },
    });
    await nextTick();

    expect(openFileSpy).toHaveBeenCalledTimes(2);
    expect(openFileSpy).toHaveBeenNthCalledWith(1, "/tmp/alpha.md");
    expect(openFileSpy).toHaveBeenNthCalledWith(2, "/tmp/beta.markdown");
    expect(wrapper.find("[data-testid='markdown-drop-overlay']").exists()).toBe(false);
  });

  it("refreshes an open clean session when workspace change events arrive", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    const fileService = await import("@/lib/file-service");
    const workspaceService = await import("@/lib/workspace-service");
    let onChanged: (() => void | Promise<void>) | undefined;

    vi.spyOn(fileService, "readMarkdownFile")
      .mockResolvedValueOnce({ path: "/tmp/note.md", content: "first" })
      .mockResolvedValueOnce({ path: "/tmp/note.md", content: "second" });
    vi.mocked(workspaceService.onWorkspaceChanged).mockImplementationOnce(async (handler) => {
      onChanged = handler;
      return () => {};
    });

    await documents.openFile("/tmp/note.md");

    mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await nextTick();
    await Promise.resolve();
    await onChanged?.();
    await nextTick();

    expect(documents.activeSession?.content).toBe("second");
  });

  it("keeps the unified settings center open when Escape exits shortcut capture", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();
    ui.openSettings("shortcuts");

    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await nextTick();

    // Trigger record button click to enter recording mode
    const recordButton = wrapper.find('[data-command-id="format.bold"] .settings-panel__capture');
    if (recordButton.exists()) {
      await recordButton.trigger("click");
      await wrapper.trigger("keydown", { key: "Escape" });

      expect(ui.settingsOpen).toBe(true);
      expect(ui.activeSettingsSection).toBe("shortcuts");
    }
  });
});
