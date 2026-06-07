<template>
  <div class="panel">
    <div class="panel__header">
      <div class="panel__title">Recent</div>
      <div class="panel__actions">
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
      >
        {{ fileName(path) }}
      </button>
      <p v-if="documents.recentFiles.length === 0" class="panel__empty">
        No recent files
      </p>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useDocumentsStore } from "@/stores/documents";

const documents = useDocumentsStore();

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
</script>
