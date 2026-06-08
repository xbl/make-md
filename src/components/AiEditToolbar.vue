<template>
  <div class="ai-edit-toolbar" data-testid="ai-edit-toolbar">
    <button v-for="preset in presets" :key="preset.id" type="button" class="ai-edit-toolbar__button">
      {{ preset.label }}
    </button>
    <button type="button" class="ai-edit-toolbar__button">Custom...</button>
  </div>
</template>

<script setup lang="ts">
import { AI_PRESETS } from "@/lib/ai/presets";

const presets = AI_PRESETS;
</script>
