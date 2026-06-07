<template>
  <li class="outline-panel__item">
    <button
      type="button"
      class="outline-panel__button"
      :style="{ paddingLeft: `${(item.level - 1) * 12 + 8}px` }"
      @click="emit('select', item.pos)"
    >
      {{ item.text || "(empty heading)" }}
    </button>
    <ul v-if="item.children?.length" class="outline-panel__list">
      <OutlineItemNode
        v-for="(child, index) in item.children"
        :key="`${child.pos}-${index}`"
        :item="child"
        @select="(pos) => emit('select', pos)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import type { OutlineItem } from "@/lib/outline";

defineProps<{
  item: OutlineItem & { children?: OutlineItem[] };
}>();

const emit = defineEmits<{
  select: [pos: number];
}>();
</script>
