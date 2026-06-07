<template>
  <div class="tab-strip">
    <div
      v-for="item in documents.sessions"
      :key="item.id"
      class="tab-group"
      :class="{ 'tab-group--active': item.id === documents.activeSessionId }"
    >
      <button
        type="button"
        class="tab"
        @click="documents.setActiveSession(item.id)"
      >
        {{ tabLabel(item) }}
      </button>
      <button
        type="button"
        class="tab__close"
        aria-label="Close tab"
        @click.stop="closeTab(item.id)"
      >
        ×
      </button>
    </div>
    <button type="button" class="tab tab--new" aria-label="New file" @click="newFile">+</button>
  </div>
</template>

<script setup lang="ts">
import { useDocumentsStore } from "@/stores/documents";

const documents = useDocumentsStore();

function tabLabel(item: { path: string; isDirty: () => boolean }) {
  const name = item.path ? item.path.split("/").pop() || "Untitled.md" : "Untitled.md";
  return item.isDirty() ? `${name} *` : name;
}

async function closeTab(id: string) {
  await documents.closeSession(id);
}

function newFile() {
  documents.createNewDocument();
}
</script>
