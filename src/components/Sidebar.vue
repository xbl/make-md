<template>
  <div class="panel">
    <div class="panel__header">
      <div class="panel__title">Workspace</div>
      <button type="button" class="panel__action">Open</button>
    </div>

    <nav class="panel__body">
      <button
        v-for="item in workspace.items"
        :key="item.id"
        type="button"
        class="nav-item"
        :class="{ 'nav-item--active': item.id === workspace.activeItemId }"
      >
        {{ item.name }}
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { useWorkspaceStore } from "@/stores/workspace";

const workspace = useWorkspaceStore();
</script>
