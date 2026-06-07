<template>
  <div
    class="app-shell"
    :class="{
      'app-shell--sidebar-collapsed': ui.sidebarCollapsed,
      'app-shell--focus': ui.focusMode,
    }"
  >
    <aside v-show="!ui.sidebarCollapsed && !ui.focusMode" class="app-shell__sidebar" data-testid="sidebar">
      <SidebarTabs />
    </aside>

    <section class="app-shell__main">
      <TabStrip v-show="!ui.focusMode" class="app-shell__tabs" />
      <EditorPane class="app-shell__editor" data-testid="editor-pane" />
      <StatusBar class="app-shell__status" data-testid="status-bar" />
    </section>

    <CommandPalette />
    <SettingsPanel />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import SidebarTabs from "@/components/SidebarTabs.vue";
import TabStrip from "@/components/TabStrip.vue";
import EditorPane from "@/components/EditorPane.vue";
import StatusBar from "@/components/StatusBar.vue";
import CommandPalette from "@/components/CommandPalette.vue";
import SettingsPanel from "@/components/SettingsPanel.vue";
import { createAppCommandRuntime } from "@/lib/app-commands";
import { useDocumentsStore } from "@/stores/documents";
import { useEditorStore } from "@/stores/editor";
import { useShortcutsStore } from "@/stores/shortcuts";
import { useUiStore } from "@/stores/ui";
import { useFolderWorkspaceStore } from "@/stores/folder-workspace";
import { pickFolder } from "@/lib/file-service";
import { createShortcutDispatcher, type ShortcutDispatcher } from "@/lib/shortcuts/dispatcher";
import { startMenuBridge } from "@/lib/menu-bridge";

const documents = useDocumentsStore();
const editorStore = useEditorStore();
const shortcuts = useShortcutsStore();
const ui = useUiStore();
const folderWorkspace = useFolderWorkspaceStore();
let unlistenClose: (() => void) | null = null;
const activeSessionId = computed(() => documents.activeSessionId);
let dispatcher: ShortcutDispatcher | null = null;
let stopMenuBridge: (() => void) | null = null;

async function openFolder() {
  const path = await pickFolder();
  if (path) {
    await folderWorkspace.setRootPath(path);
    folderWorkspace.setActiveTab("files");
  }
}

function getShortcutContext() {
  const view = editorStore.view;
  const editorFocused = Boolean(view?.hasFocus());
  const selection = view?.state.selection;

  return {
    editorFocused,
    hasSelection: Boolean(selection && !selection.empty),
    inInlineMark: Boolean(view?.state.selection.$from.marks().length),
  };
}

function canRunEditorCommand(commandId: string) {
  const view = editorStore.view;
  if (!view && commandId !== "view.outline" && commandId !== "view.files") {
    return false;
  }

  return true;
}

function runEditorCommand(commandId: string) {
  if (!canRunEditorCommand(commandId)) {
    return false;
  }

  if (commandId === "view.outline") {
    folderWorkspace.setActiveTab("outline");
    return true;
  }

  if (commandId === "view.files") {
    folderWorkspace.setActiveTab("files");
    return true;
  }

  window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId } }));
  return true;
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== "Escape") {
    return false;
  }

  if (ui.settingsShortcutRecording) {
    return false;
  }

  if (ui.commandPaletteOpen) {
    event.preventDefault();
    ui.closeCommandPalette();
    return true;
  }

  if (ui.settingsOpen) {
    event.preventDefault();
    ui.closeSettings();
    return true;
  }

  if (ui.findReplaceOpen) {
    event.preventDefault();
    ui.closeFindReplace();
    return true;
  }

  return false;
}

async function handleKeydown(event: KeyboardEvent) {
  if (handleEscape(event)) {
    return;
  }

  await dispatcher?.handleKeydown(event);
}

onMounted(async () => {
  ui.applyTheme();
  void documents.loadRecent();
  const runtime = createAppCommandRuntime({
    openFile: () => documents.openFileDialog(),
    openFolder,
    createNew: () => documents.createNewDocument(),
    save: () => documents.saveActiveFile(),
    saveAs: () => documents.saveAsDialog(),
    exportHtml: () => documents.exportActiveHtml(),
    exportPdf: () => documents.exportActivePdf(),
    openFind: () => ui.openFindReplace("find"),
    openReplace: () => ui.openFindReplace("replace"),
    toggleSidebar: () => ui.toggleSidebar(),
    toggleFocusMode: () => ui.toggleFocusMode(),
    openSettings: () => ui.openSettings(),
    openCommandPalette: () => ui.openCommandPalette(),
    closeTab: () => (activeSessionId.value ? documents.closeSession(activeSessionId.value) : Promise.resolve(true)),
    canRunEditorCommand,
    runEditorCommand,
  });
  dispatcher = createShortcutDispatcher({
    handlers: runtime.handlers,
    getContext: getShortcutContext,
    getChordMap: () => shortcuts.chordMap,
    isEditorFocused: () => Boolean(editorStore.view?.hasFocus()),
  });
  window.addEventListener("keydown", handleKeydown, true);
  stopMenuBridge = await startMenuBridge((commandId) => {
    void dispatcher?.run(commandId);
  });

  if (isTauri()) {
    const appWindow = getCurrentWindow();
    unlistenClose = await appWindow.onCloseRequested(async (event) => {
      const ok = await documents.confirmBeforeQuit();
      if (!ok) {
        event.preventDefault();
      }
    });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleKeydown, true);
  stopMenuBridge?.();
  unlistenClose?.();
  void documents.flushAutosave();
});
</script>
