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
import { computed, inject, ref, watch } from "vue";
import { TextSelection } from "prosemirror-state";
import { extractOutline, nestOutlineItems, type OutlineItem } from "@/lib/outline";
import { EditorViewKey } from "@/editor/editor-context";
import OutlineItemNode from "@/components/OutlineItemNode.vue";

const editorContext = inject(EditorViewKey);
const items = ref<OutlineItem[]>([]);

let timer: ReturnType<typeof setTimeout> | null = null;

function refreshOutline() {
  const view = editorContext?.view.value;
  if (!view) {
    items.value = [];
    return;
  }
  items.value = extractOutline(view.state.doc);
}

watch(
  () => editorContext?.docVersion.value,
  () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(refreshOutline, 200);
  },
  { immediate: true },
);

watch(
  () => editorContext?.view.value,
  () => refreshOutline(),
);

const nestedItems = computed(() => nestOutlineItems(items.value));

function scrollToHeading(pos: number) {
  const view = editorContext?.view.value;
  if (!view) {
    return;
  }
  const node = view.state.doc.nodeAt(pos);
  if (!node) {
    return;
  }
  const selection = TextSelection.near(view.state.doc.resolve(pos + 1));
  view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  const dom = view.nodeDOM(pos);
  if (dom instanceof HTMLElement) {
    dom.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  view.focus();
}
</script>
