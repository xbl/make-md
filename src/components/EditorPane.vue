<template>
  <div class="editor-pane">
    <header class="editor-pane__hero">
      <div>
        <p class="editor-pane__eyebrow">Typora-style writing surface</p>
        <h1 class="editor-pane__title">Start typing to build the editor core.</h1>
      </div>
      <button type="button" class="editor-pane__ghost">Command Palette</button>
    </header>

    <div class="editor-pane__canvas">
      <EditorView v-if="activeSession" />
      <div v-else class="editor-placeholder">
        The ProseMirror editor will mount here.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDocumentsStore } from "@/stores/documents";
import EditorView from "@/editor/EditorView.vue";

const documents = useDocumentsStore();
const activeSession = computed(() => documents.activeSession);
</script>
