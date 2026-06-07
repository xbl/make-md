<template>
  <div ref="mountRef" class="editor-view"></div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from "vue";
import { EditorState } from "prosemirror-state";
import { EditorView as PMEditorView } from "prosemirror-view";
import { markdownSchema } from "@/editor/schema";
import { parseMarkdown } from "@/editor/markdown-parser";
import { serializeMarkdown } from "@/editor/markdown-serializer";
import { createEditorPlugins } from "@/editor/plugins";
import { createEditorNodeViews } from "@/editor/code-block-view";
import { EditorViewKey } from "@/editor/editor-context";
import { useDocumentsStore } from "@/stores/documents";

const mountRef = ref<HTMLDivElement | null>(null);
const documents = useDocumentsStore();
const viewRef = ref<PMEditorView | null>(null);
const docVersion = ref(0);
let view: PMEditorView | null = null;

provide(EditorViewKey, { view: viewRef, docVersion });

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
    viewRef.value = null;
    return;
  }

  const doc = parseMarkdown(activeSession.value.content || "");
  const state = EditorState.create({
    schema: markdownSchema,
    doc,
    plugins: createEditorPlugins(),
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
      docVersion.value += 1;
      syncSessionContent();
    },
  });
  viewRef.value = view;
  docVersion.value += 1;
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
  viewRef.value = null;
});
</script>
