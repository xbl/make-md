<template>
  <div ref="mountRef" class="editor-view"></div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorState } from "prosemirror-state";
import { EditorView as PMEditorView } from "prosemirror-view";
import { markdownSchema } from "@/editor/schema";
import { parseMarkdown } from "@/editor/markdown-parser";
import { serializeMarkdown } from "@/editor/markdown-serializer";
import { createEditorPlugins } from "@/editor/plugins";
import { createEditorNodeViews } from "@/editor/code-block-view";
import { useDocumentsStore } from "@/stores/documents";
import { useEditorStore } from "@/stores/editor";

const mountRef = ref<HTMLDivElement | null>(null);
const documents = useDocumentsStore();
const editorStore = useEditorStore();
let view: PMEditorView | null = null;

const activeSession = computed(() => documents.activeSession);

function syncSessionContent() {
  const session = activeSession.value;
  if (!session || !view) {
    return;
  }
  const content = serializeMarkdown(view.state.doc);
  documents.scheduleAutosave(content);
}

function mountEditor() {
  if (!mountRef.value || !activeSession.value) {
    editorStore.clearView();
    return;
  }

  const doc = parseMarkdown(activeSession.value.content || "");
  const state = EditorState.create({
    schema: markdownSchema,
    doc,
    plugins: createEditorPlugins({
      getDocPath: () => activeSession.value?.path || undefined,
      onImageError: (message) => window.alert(message),
    }),
  });

  view?.destroy();
  view = new PMEditorView(mountRef.value, {
    state,
    nodeViews: createEditorNodeViews(),
    dispatchTransaction(transaction) {
      const nextState = view?.state.apply(transaction);
      if (!nextState || !view) {
        return;
      }
      view.updateState(nextState);
      editorStore.bumpDocVersion();
      syncSessionContent();
    },
  });
  editorStore.setView(view);
}

onMounted(async () => {
  await nextTick();
  mountEditor();
});

watch(
  () => activeSession.value?.id,
  async () => {
    await nextTick();
    mountEditor();
  },
);

onBeforeUnmount(() => {
  void documents.flushAutosave();
  view?.destroy();
  view = null;
  editorStore.clearView();
});
</script>
