<template>
  <div class="status-bar">
    <span>{{ statusText }}</span>
    <span>{{ modeText }}</span>
    <span>Markdown</span>
    <span>UTF-8</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";

const documents = useDocumentsStore();
const ui = useUiStore();
const statusText = computed(() => {
  const active = documents.activeSession;
  if (!active) {
    return "No document";
  }
  const name = active.path.split("/").pop() ?? active.path;
  return active.isDirty() ? `${name} (unsaved)` : name;
});
const modeText = computed(() => (ui.sourceMode ? "Source" : "Rich Text"));
</script>
