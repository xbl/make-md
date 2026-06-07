<template>
  <div class="outline-panel">
    <p v-if="items.length === 0" class="panel__empty">No headings in this document</p>
    <ul v-else class="outline-panel__list">
      <OutlineItemNode
        v-for="(item, index) in nestedItems"
        :key="`${item.pos}-${index}`"
        :item="item"
        @select="scrollToHeading"
      />
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { parseMarkdown } from "@/editor/markdown-parser";
import { extractOutline, nestOutlineItems, type OutlineItem } from "@/lib/outline";
import { scrollEditorToPosition } from "@/lib/editor-scroll";
import OutlineItemNode from "@/components/OutlineItemNode.vue";
import { useDocumentsStore } from "@/stores/documents";
import { useEditorStore } from "@/stores/editor";

const documents = useDocumentsStore();
const editorStore = useEditorStore();
const items = ref<OutlineItem[]>([]);

let timer: ReturnType<typeof setTimeout> | null = null;

function refreshOutline() {
  const view = editorStore.view;
  if (view) {
    items.value = extractOutline(view.state.doc);
    return;
  }

  const content = documents.activeSession?.content ?? "";
  if (!content.trim()) {
    items.value = [];
    return;
  }

  items.value = extractOutline(parseMarkdown(content));
}

watch(
  () => [editorStore.docVersion, documents.activeSession?.id, documents.activeSession?.content] as const,
  () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(refreshOutline, 200);
  },
  { immediate: true },
);

const nestedItems = computed(() => nestOutlineItems(items.value));

function scrollToHeading(pos: number) {
  const view = editorStore.view;
  if (!view) {
    return;
  }
  scrollEditorToPosition(view, pos);
}
</script>
