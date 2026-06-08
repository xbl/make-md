<template>
  <div class="panel">
    <div class="panel__header">
      <div class="panel__title">Recent</div>
      <div class="panel__actions">
        <button
          v-if="documents.recentFiles.length > 0"
          type="button"
          class="panel__action"
          @click="clearRecent"
        >
          Clear
        </button>
        <button type="button" class="panel__action" @click="newFile">New</button>
        <button type="button" class="panel__action" @click="openFile">Open</button>
      </div>
    </div>

    <nav class="panel__body">
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
        No recent files
      </p>
    </nav>
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
import {
  createContextMenuController,
  type ContextMenuActionItem,
  type ContextMenuItem,
} from "@/lib/context-menu";
import { revealInFinder } from "@/lib/workspace-service";
import { useDocumentsStore } from "@/stores/documents";

const documents = useDocumentsStore();
const menu = createContextMenuController();
const selectedRecentPath = ref<string | null>(null);
const menuItems = computed<ContextMenuItem[]>(() => [
  { type: "action", id: "open", label: "Open" },
  { type: "action", id: "remove", label: "Remove from Recent" },
  { type: "action", id: "reveal", label: "Reveal in Finder" },
]);

function fileName(path: string) {
  return path.split("/").pop() ?? path;
}

function newFile() {
  documents.createNewDocument();
}

async function openFile() {
  await documents.openFileDialog();
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
</script>
