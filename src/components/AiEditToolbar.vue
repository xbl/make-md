<template>
  <div class="editor-toolbar" :style="toolbarStyle" data-testid="ai-edit-toolbar">
    <button v-for="preset in presets" :key="preset.id" type="button" class="editor-toolbar__btn">
      {{ t(`ai.${preset.id}`) }}
    </button>
    <button type="button" class="editor-toolbar__btn">{{ t("ai.custom") }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { AI_PRESETS } from "@/lib/ai/presets";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

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
