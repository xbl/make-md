<template>
  <div class="status-bar">
    <span>{{ statusText }}</span>
    <span>{{ modeText }}</span>
    <span>{{ wordCountText }}</span>
    <span>Markdown</span>
    <span>UTF-8</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDocumentsStore } from "@/stores/documents";
import { useEditorStore } from "@/stores/editor";
import { useUiStore } from "@/stores/ui";
import { countWords, readingTimeMinutes } from "@/lib/word-count";

const documents = useDocumentsStore();
const editorStore = useEditorStore();
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

const wordCountText = computed(() => {
  const view = editorStore.view;
  if (!view) {
    return "";
  }
  const text = view.state.doc.textContent;
  const words = countWords(text);
  const minutes = readingTimeMinutes(words);
  return `${words} words · ${minutes} min`;
});
</script>
