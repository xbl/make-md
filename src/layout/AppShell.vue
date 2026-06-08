<template>
  <div
    class="app-shell"
    :class="{
      'app-shell--sidebar-collapsed': ui.sidebarCollapsed,
      'app-shell--focus': ui.focusMode,
    }"
    @dragenter="onDragEnter"
    @dragover="onDragOver"
    @dragleave="onDragLeave"
    @drop="onDrop"
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
    <div v-if="markdownDragActive" class="app-shell__drag-overlay" data-testid="markdown-drop-overlay">
      <div class="app-shell__drag-overlay-card">
        <p class="app-shell__drag-overlay-title">Drop Markdown files to open</p>
        <p class="app-shell__drag-overlay-hint">Supports .md and .markdown</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
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
import { onWorkspaceChanged } from "@/lib/workspace-service";

const documents = useDocumentsStore();
const editorStore = useEditorStore();
const shortcuts = useShortcutsStore();
const ui = useUiStore();
const folderWorkspace = useFolderWorkspaceStore();
let unlistenClose: (() => void) | null = null;
let unlistenDragDrop: (() => void) | null = null;
let stopWorkspaceChangeWatch: (() => void) | null = null;
const activeSessionId = computed(() => documents.activeSessionId);
let dispatcher: ShortcutDispatcher | null = null;
let stopMenuBridge: (() => void) | null = null;
const markdownDragActive = ref(false);
const markdownDragDepth = ref(0);

type DragFileLike = {
  name?: string;
  path?: string;
};

function isMarkdownFile(file: DragFileLike) {
  const name = file.name?.toLowerCase() ?? "";
  return name.endsWith(".md") || name.endsWith(".markdown");
}

function getDraggedMarkdownFiles(event: DragEvent) {
  const files = Array.from(event.dataTransfer?.files ?? []) as DragFileLike[];
  return files.filter((file) => isMarkdownFile(file) && typeof file.path === "string" && file.path.length > 0);
}

function hasDraggedMarkdownFiles(event: DragEvent) {
  return getDraggedMarkdownFiles(event).length > 0;
}

function isMarkdownPath(path: string) {
  const lower = path.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown");
}

function getMarkdownPaths(paths: string[]) {
  return paths.filter((path) => isMarkdownPath(path));
}

async function openMarkdownPaths(paths: string[]) {
  for (const path of paths) {
    try {
      await documents.openFile(path);
    } catch {
      continue;
    }
  }
}

async function refreshOpenSessionsFromDisk() {
  for (const session of documents.sessions) {
    if (!session.path) {
      continue;
    }
    await documents.refreshSessionFromDisk(session.path);
  }
}

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

  if (commandId === "view.source") {
    ui.toggleSourceMode();
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

function onDragEnter(event: DragEvent) {
  if (!hasDraggedMarkdownFiles(event)) {
    return;
  }

  markdownDragDepth.value += 1;
  markdownDragActive.value = true;
}

function onDragOver(event: DragEvent) {
  if (!hasDraggedMarkdownFiles(event)) {
    return;
  }

  event.preventDefault();
  markdownDragActive.value = true;
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = "copy";
  }
}

function onDragLeave(event: DragEvent) {
  if (!markdownDragActive.value) {
    return;
  }

  if (event.currentTarget && event.relatedTarget instanceof Node && event.currentTarget instanceof Node) {
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
  }

  markdownDragDepth.value = Math.max(0, markdownDragDepth.value - 1);
  if (markdownDragDepth.value === 0) {
    markdownDragActive.value = false;
  }
}

async function onDrop(event: DragEvent) {
  const markdownFiles = getDraggedMarkdownFiles(event);
  if (markdownFiles.length > 0) {
    event.preventDefault();
  }

  markdownDragActive.value = false;
  markdownDragDepth.value = 0;
  await openMarkdownPaths(markdownFiles.map((file) => file.path!));
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
    toggleSourceMode: () => ui.toggleSourceMode(),
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
  stopWorkspaceChangeWatch = await onWorkspaceChanged(async () => {
    await refreshOpenSessionsFromDisk();
  });

  if (isTauri()) {
    const appWindow = getCurrentWindow();
    unlistenDragDrop = await appWindow.onDragDropEvent(async (event) => {
      if (event.payload.type === "enter") {
        markdownDragActive.value = getMarkdownPaths(event.payload.paths).length > 0;
        return;
      }

      if (event.payload.type === "over") {
        return;
      }

      if (event.payload.type === "leave") {
        markdownDragActive.value = false;
        markdownDragDepth.value = 0;
        return;
      }

      const markdownPaths = getMarkdownPaths(event.payload.paths);
      markdownDragActive.value = false;
      markdownDragDepth.value = 0;
      await openMarkdownPaths(markdownPaths);
    });

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
  stopWorkspaceChangeWatch?.();
  unlistenDragDrop?.();
  unlistenClose?.();
  void documents.flushAutosave();
});
</script>
