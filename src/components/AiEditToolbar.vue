<template>
  <div class="ai-edit-toolbar" :style="toolbarStyle" data-testid="ai-edit-toolbar">
    <button v-for="preset in presets" :key="preset.id" type="button" class="ai-edit-toolbar__button">
      {{ preset.label }}
    </button>
    <button type="button" class="ai-edit-toolbar__button">Custom...</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { AI_PRESETS } from "@/lib/ai/presets";

const props = defineProps<{
  left?: number;
  top?: number;
}>();

const presets = AI_PRESETS;
const toolbarStyle = computed(() => ({
  left: `${props.left ?? 0}px`,
  top: `${props.top ?? 0}px`,
}));
</script>
