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
        <div class="panel__title">{{ folderWorkspace.hasFolder ? folderTitle : "Recent" }}</div>
        <div class="panel__actions">
          <button type="button" class="panel__action" @click="newFile">New</button>
          <button type="button" class="panel__action" @click="openFolder">Folder</button>
          <button v-if="!folderWorkspace.hasFolder" type="button" class="panel__action" @click="openFile">
            Open
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
        >
          {{ fileName(path) }}
        </button>
        <p v-if="documents.recentFiles.length === 0" class="panel__empty">
          No recent files
        </p>
      </nav>
    </div>

    <div v-else class="panel__body">
      <OutlinePanel />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import FileTree from "@/components/FileTree.vue";
import OutlinePanel from "@/components/OutlinePanel.vue";
import { pickFolder } from "@/lib/file-service";
import { useDocumentsStore } from "@/stores/documents";
import { useFolderWorkspaceStore } from "@/stores/folder-workspace";

const documents = useDocumentsStore();
const folderWorkspace = useFolderWorkspaceStore();

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

async function openTreeFile(path: string) {
  await documents.openFile(path);
}
</script>
