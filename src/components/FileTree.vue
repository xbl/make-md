<template>
  <ul v-if="nodes.length" class="file-tree">
    <FileTreeNode
      v-for="node in nodes"
      :key="node.path"
      :node="node"
      :depth="0"
      @open-file="(path) => emit('open-file', path)"
    />
  </ul>
  <p v-else class="panel__empty">No markdown files in this folder</p>
</template>

<script setup lang="ts">
import type { TreeNode } from "@/lib/workspace-service";
import FileTreeNode from "@/components/FileTreeNode.vue";

defineProps<{
  nodes: TreeNode[];
}>();

const emit = defineEmits<{
  "open-file": [path: string];
}>();
</script>
