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
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "@tauri-apps/api/core";
import SidebarTabs from "@/components/SidebarTabs.vue";
import TabStrip from "@/components/TabStrip.vue";
import EditorPane from "@/components/EditorPane.vue";
import StatusBar from "@/components/StatusBar.vue";
import CommandPalette from "@/components/CommandPalette.vue";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";
import { useFolderWorkspaceStore } from "@/stores/folder-workspace";
import { pickFolder } from "@/lib/file-service";

const documents = useDocumentsStore();
const ui = useUiStore();
const folderWorkspace = useFolderWorkspaceStore();
let unlistenClose: (() => void) | null = null;

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "F8") {
    event.preventDefault();
    ui.toggleFocusMode();
    return;
  }

  const mod = event.metaKey || event.ctrlKey;
  if (!mod) {
    return;
  }

  if (event.key === "p" && event.shiftKey) {
    event.preventDefault();
    ui.toggleCommandPalette();
    return;
  }

  if (event.key === "n") {
    event.preventDefault();
    documents.createNewDocument();
    return;
  }

  if (event.key === "f" && mod && event.altKey) {
    event.preventDefault();
    ui.openFindReplace("replace");
    return;
  }

  if (event.key === "f" && mod) {
    event.preventDefault();
    ui.openFindReplace("find");
    return;
  }

  if (event.key === "Escape" && ui.findReplaceOpen) {
    event.preventDefault();
    ui.closeFindReplace();
    return;
  }

  if (event.key === "e" && mod && event.shiftKey) {
    event.preventDefault();
    void documents.exportActivePdf();
    return;
  }

  if (event.key === "e" && mod && !event.shiftKey) {
    event.preventDefault();
    void documents.exportActiveHtml();
    return;
  }

  if (event.key === "l" && event.shiftKey) {
    event.preventDefault();
    ui.toggleTheme();
    return;
  }

  if (event.key === "\\") {
    event.preventDefault();
    ui.toggleSidebar();
    return;
  }

  if (event.key === "s" && event.shiftKey) {
    event.preventDefault();
    void documents.saveAsDialog();
    return;
  }

  if (event.key === "s") {
    event.preventDefault();
    void documents.saveActiveFile();
    return;
  }

  if (event.key === "o" && event.shiftKey) {
    event.preventDefault();
    void (async () => {
      const path = await pickFolder();
      if (path) {
        await folderWorkspace.setRootPath(path);
        folderWorkspace.setActiveTab("files");
      }
    })();
    return;
  }

  if (event.key === "o") {
    event.preventDefault();
    void documents.openFileDialog();
  }
}

onMounted(async () => {
  ui.applyTheme();
  void documents.loadRecent();
  window.addEventListener("keydown", handleKeydown);

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
  window.removeEventListener("keydown", handleKeydown);
  unlistenClose?.();
  void documents.flushAutosave();
});
</script>
