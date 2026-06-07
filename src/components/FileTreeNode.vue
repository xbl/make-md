<template>
  <li class="file-tree__item">
    <button
      v-if="node.kind === 'folder'"
      type="button"
      class="file-tree__row"
      :style="{ paddingLeft: `${depth * 12 + 8}px` }"
      @click="toggle"
    >
      <span class="file-tree__chevron" :class="{ 'file-tree__chevron--open': expanded }">›</span>
      <span class="file-tree__label">{{ node.name }}</span>
    </button>
    <button
      v-else
      type="button"
      class="file-tree__row file-tree__row--file"
      :class="{ 'nav-item--active': node.path === documents.activeSessionId }"
      :style="{ paddingLeft: `${depth * 12 + 20}px` }"
      @click="openFile"
    >
      <span class="file-tree__label">{{ node.name }}</span>
    </button>

    <ul v-if="node.kind === 'folder' && expanded && node.children.length" class="file-tree">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        @open-file="(path) => emit('open-file', path)"
      />
    </ul>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TreeNode } from "@/lib/workspace-service";
import { useFolderWorkspaceStore } from "@/stores/folder-workspace";
import { useDocumentsStore } from "@/stores/documents";

const props = defineProps<{
  node: TreeNode;
  depth: number;
}>();

const emit = defineEmits<{
  "open-file": [path: string];
}>();

const folderWorkspace = useFolderWorkspaceStore();
const documents = useDocumentsStore();

const expanded = computed(() => folderWorkspace.isExpanded(props.node.path));

function toggle() {
  folderWorkspace.toggleExpanded(props.node.path);
  folderWorkspace.setSelectedPath(props.node.path);
}

function openFile() {
  folderWorkspace.setSelectedPath(props.node.path);
  emit("open-file", props.node.path);
}
</script>
