<template>
  <div class="editor-pane">
    <EditorView v-if="activeSession" />
    <div v-else class="editor-empty">
      <p class="editor-empty__title">Open a Markdown file to start writing</p>
      <div class="editor-empty__actions">
        <button type="button" class="editor-empty__action" @click="newFile">
          New file
        </button>
        <button type="button" class="editor-empty__action editor-empty__action--ghost" @click="openFile">
          Open file…
        </button>
      </div>
      <p class="editor-empty__hint">⌘N new · ⌘O open · ⌘S save · ⌘⇧P commands</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useDocumentsStore } from "@/stores/documents";
import EditorView from "@/editor/EditorView.vue";

const documents = useDocumentsStore();
const activeSession = computed(() => documents.activeSession);

function newFile() {
  documents.createNewDocument();
}

async function openFile() {
  await documents.openFileDialog();
}
</script>
