<template>
  <div class="editor-pane" :class="{ 'editor-pane--source': ui.sourceMode }">
    <FindReplaceBar v-if="activeSession" />
    <SourceEditor
      v-if="activeSession && ui.sourceMode"
      :model-value="activeSession.content"
      @update:model-value="updateSource"
    />
    <EditorView v-else-if="activeSession" />
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
import { useUiStore } from "@/stores/ui";
import EditorView from "@/editor/EditorView.vue";
import FindReplaceBar from "@/components/FindReplaceBar.vue";
import SourceEditor from "@/components/SourceEditor.vue";

const documents = useDocumentsStore();
const ui = useUiStore();
const activeSession = computed(() => documents.activeSession);

function newFile() {
  documents.createNewDocument();
}

async function openFile() {
  await documents.openFileDialog();
}

function updateSource(nextContent: string) {
  const session = activeSession.value;
  if (!session) {
    return;
  }
  documents.scheduleAutosave(nextContent);
}
</script>
