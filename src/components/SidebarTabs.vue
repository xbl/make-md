<template>
  <div class="panel sidebar-tabs">
    <div class="sidebar-tabs__bar">
      <button
        type="button"
        class="sidebar-tabs__tab"
        :class="{ 'sidebar-tabs__tab--active': folderWorkspace.activeTab === 'files' }"
        @click="folderWorkspace.setActiveTab('files')"
      >
        Files
      </button>
      <button
        type="button"
        class="sidebar-tabs__tab"
        :class="{ 'sidebar-tabs__tab--active': folderWorkspace.activeTab === 'outline' }"
        @click="folderWorkspace.setActiveTab('outline')"
      >
        Outline
      </button>
    </div>

    <div v-if="folderWorkspace.activeTab === 'files'" class="panel__body">
      <div class="panel__header">
        <div class="panel__title">{{ folderWorkspace.hasFolder ? folderTitle : t("sidebar.recent.title") }}</div>
        <div class="panel__actions">
          <button
            v-if="!folderWorkspace.hasFolder && documents.recentFiles.length > 0"
            type="button"
            class="panel__action"
            data-testid="recent-clear"
            title="Clear Recent Files"
            @click="clearRecent"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6 4v8a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V4M3 7h10" />
            </svg>
          </button>
          <button type="button" class="panel__action" title="New File" @click="newFile">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 2.5h6l3 3v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h2z" />
              <path d="M8 7v4M6 9h4" />
            </svg>
          </button>
          <button type="button" class="panel__action" title="Open Folder" @click="openFolder">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M2 5.5V3.5a1 1 0 0 1 1-1h2.2l1.6 2h6.2a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V5.5z" />
            </svg>
          </button>
          <button v-if="!folderWorkspace.hasFolder" type="button" class="panel__action" title="Open File" @click="openFile">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 8.5V3.5a1 1 0 0 1 1-1h6l3 3v7a1 1 0 0 1-1 1H7.5M3 8.5l2.5 2.5M3 8.5l2.5-2.5" />
            </svg>
          </button>
        </div>
      </div>

      <FileTree
        v-if="folderWorkspace.hasFolder && folderWorkspace.tree"
        :nodes="folderWorkspace.tree.children"
        @open-file="openTreeFile"
      />

      <nav v-else class="panel__body panel__body--nested">
        <button
          v-for="path in documents.recentFiles"
          :key="path"
          type="button"
          class="nav-item"
          :class="{ 'nav-item--active': path === documents.activeSessionId }"
          @click="openRecent(path)"
          @contextmenu.prevent="openRecentMenu($event, path)"
        >
          {{ fileName(path) }}
        </button>
        <p v-if="documents.recentFiles.length === 0" class="panel__empty">
          {{ t("sidebar.recent.empty") }}
        </p>
      </nav>
    </div>

    <div v-else class="panel__body">
      <OutlinePanel />
    </div>
    <ContextMenu
      :open="menu.state.open"
      :x="menu.state.x"
      :y="menu.state.y"
      :items="menuItems"
      @close="menu.close"
      @select="onMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import ContextMenu from "@/components/ContextMenu.vue";
import FileTree from "@/components/FileTree.vue";
import OutlinePanel from "@/components/OutlinePanel.vue";
import { useI18n } from "@/composables/useI18n";
import {
  createContextMenuController,
  type ContextMenuActionItem,
  type ContextMenuItem,
} from "@/lib/context-menu";
import { pickFolder } from "@/lib/file-service";
import { revealInFinder } from "@/lib/workspace-service";
import { useDocumentsStore } from "@/stores/documents";
import { useFolderWorkspaceStore } from "@/stores/folder-workspace";

const documents = useDocumentsStore();
const folderWorkspace = useFolderWorkspaceStore();
const { t } = useI18n();
const menu = createContextMenuController();
const selectedRecentPath = ref<string | null>(null);
const menuItems = computed<ContextMenuItem[]>(() => [
  { type: "action", id: "open", label: t("common.open") },
  { type: "action", id: "remove", label: t("sidebar.recent.remove") },
  { type: "action", id: "reveal", label: t("sidebar.recent.reveal") },
]);

const folderTitle = computed(() => {
  const parts = folderWorkspace.rootPath.split(/[/\\]/);
  return parts[parts.length - 1] || "Workspace";
});

function fileName(path: string) {
  return path.split(/[/\\]/).pop() ?? path;
}

function newFile() {
  documents.createNewDocument();
}

async function openFile() {
  await documents.openFileDialog();
}

async function openFolder() {
  const path = await pickFolder();
  if (!path) {
    return;
  }
  await folderWorkspace.setRootPath(path);
  folderWorkspace.setActiveTab("files");
}

async function openRecent(path: string) {
  await documents.openFile(path);
}

function openRecentMenu(event: MouseEvent, path: string) {
  selectedRecentPath.value = path;
  menu.openAt(event.clientX, event.clientY);
}

function onMenuSelect(item: ContextMenuActionItem) {
  const path = selectedRecentPath.value;
  if (!path) {
    menu.close("programmatic");
    return;
  }

  if (item.id === "open") {
    void openRecent(path);
    menu.close("programmatic");
    return;
  }

  if (item.id === "remove") {
    void removeRecent(path);
    return;
  }

  if (item.id === "reveal") {
    void revealRecent(path);
  }
}

async function removeRecent(path: string) {
  menu.close("programmatic");
  await documents.removeRecent(path);
}

async function revealRecent(path: string) {
  menu.close("programmatic");
  try {
    await revealInFinder(path);
  } catch (error) {
    window.alert(String(error));
  }
}

async function clearRecent() {
  await documents.clearRecent();
}

async function openTreeFile(path: string) {
  await documents.openFile(path);
}
</script>
