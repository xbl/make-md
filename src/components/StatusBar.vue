<template>
  <div class="status-bar">
    <span>{{ statusText }}</span>
    <span>Markdown</span>
    <span>UTF-8</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDocumentsStore } from "@/stores/documents";

const documents = useDocumentsStore();
const statusText = computed(() => {
  const active = documents.activeSession;
  return active ? `${active.isDirty() ? "*" : ""}Ready` : "No document";
});
</script>
