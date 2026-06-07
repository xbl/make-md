<template>
  <div class="tab-strip">
    <button
      v-for="item in documents.sessions"
      :key="item.id"
      type="button"
      class="tab"
      :class="{ 'tab--active': item.id === documents.activeSessionId }"
    >
      {{ item.path.split("/").pop() || "Untitled.md" }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useDocumentsStore } from "@/stores/documents";

const documents = useDocumentsStore();
</script>
