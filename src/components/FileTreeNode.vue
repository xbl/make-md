<template>
  <li class="file-tree__item">
    <button
      v-if="node.kind === 'folder'"
      type="button"
      class="file-tree__row"
      :style="{ paddingLeft: `${depth * 12 + 8}px` }"
      @click="toggle"
      @contextmenu.prevent="openMenu($event, 'folder')"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop"
    >
      <FileIcon kind="folder" :open="expanded" />
      <span class="file-tree__label">{{ node.name }}</span>
    </button>
    <button
      v-else
      type="button"
      class="file-tree__row file-tree__row--file"
      :class="{ 'nav-item--active': node.path === documents.activeSessionId }"
      :style="{ paddingLeft: `${depth * 12 + 20}px` }"
      draggable="true"
      @click="openFile"
      @contextmenu.prevent="openMenu($event, 'file')"
      @dragstart="onDragStart"
    >
      <FileIcon kind="file" :ext="fileExt" />
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

    <ContextMenu
      :open="menu.state.open"
      :x="menu.state.x"
      :y="menu.state.y"
      :items="menuItems"
      @close="menu.close"
      @select="onMenuSelect"
    />
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import ContextMenu from "@/components/ContextMenu.vue";
import FileIcon from "@/components/FileIcon.vue";
import {
  createContextMenuController,
  type ContextMenuActionItem,
  type ContextMenuItem,
} from "@/lib/context-menu";
import type { TreeNode } from "@/lib/workspace-service";
import {
  createWorkspaceFile,
  deleteWorkspaceFile,
  moveWorkspaceFile,
  renameWorkspaceFile,
  revealInFinder,
} from "@/lib/workspace-service";
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

const menu = createContextMenuController();

const expanded = computed(() => folderWorkspace.isExpanded(props.node.path));

const fileExt = computed(() => {
  if (props.node.kind !== "file") return undefined;
  const name = props.node.name;
  const dot = name.lastIndexOf(".");
  if (dot === -1 || dot === name.length - 1) return undefined;
  return name.slice(dot + 1).toLowerCase();
});
const menuItems = computed<ContextMenuItem[]>(() =>
  props.node.kind === "folder"
    ? [
        { type: "action", id: "new-file", label: "New File" },
        { type: "action", id: "reveal", label: "Reveal in Finder" },
      ]
    : [
        { type: "action", id: "open", label: "Open" },
        { type: "action", id: "rename", label: "Rename" },
        { type: "action", id: "delete", label: "Delete" },
        { type: "action", id: "reveal", label: "Reveal in Finder" },
      ],
);

function toggle() {
  folderWorkspace.toggleExpanded(props.node.path);
  folderWorkspace.setSelectedPath(props.node.path);
}

function openFile() {
  folderWorkspace.setSelectedPath(props.node.path);
  emit("open-file", props.node.path);
}

function openMenu(event: MouseEvent, kind: "file" | "folder") {
  folderWorkspace.setSelectedPath(props.node.path);
  menu.openAt(event.clientX, event.clientY);
}

function onMenuSelect(item: ContextMenuActionItem) {
  if (props.node.kind === "folder" && item.id === "new-file") {
    void createFile();
    return;
  }

  if (props.node.kind === "file" && item.id === "open") {
    openFile();
    menu.close("programmatic");
    return;
  }

  if (props.node.kind === "file" && item.id === "rename") {
    void renameFile();
    return;
  }

  if (props.node.kind === "file" && item.id === "delete") {
    void deleteFile();
    return;
  }

  if (item.id === "reveal") {
    void revealFile();
  }
}

async function createFile() {
  menu.close("programmatic");
  const name = window.prompt("New file name", "Untitled");
  if (!name?.trim()) {
    return;
  }
  try {
    const path = await createWorkspaceFile(props.node.path, name.trim());
    await folderWorkspace.refreshTree();
    emit("open-file", path);
  } catch (error) {
    window.alert(String(error));
  }
}

async function renameFile() {
  menu.close("programmatic");
  const current = props.node.name.replace(/\.(md|markdown)$/i, "");
  const name = window.prompt("Rename file", current);
  if (!name?.trim()) {
    return;
  }
  const parent = props.node.path.replace(/[/\\][^/\\]+$/, "");
  const extension = props.node.name.match(/\.(md|markdown)$/i)?.[0] ?? ".md";
  const nextName = name.endsWith(".md") || name.endsWith(".markdown") ? name : `${name}${extension}`;
  const nextPath = `${parent}/${nextName}`;
  try {
    await renameWorkspaceFile(props.node.path, nextPath);
    documents.retargetSessionPath(props.node.path, nextPath);
    await folderWorkspace.refreshTree();
  } catch (error) {
    window.alert(String(error));
  }
}

async function deleteFile() {
  menu.close("programmatic");
  if (!window.confirm(`Delete ${props.node.name}?`)) {
    return;
  }
  const closed = await documents.closeSession(props.node.path);
  if (!closed) {
    return;
  }
  try {
    await deleteWorkspaceFile(props.node.path);
    await folderWorkspace.refreshTree();
  } catch (error) {
    window.alert(String(error));
  }
}

async function revealFile() {
  menu.close("programmatic");
  try {
    await revealInFinder(props.node.path);
  } catch (error) {
    window.alert(String(error));
  }
}

function onDragStart(event: DragEvent) {
  event.dataTransfer?.setData("text/plain", props.node.path);
}

function onDragOver(event: DragEvent) {
  if (props.node.kind !== "folder") {
    return;
  }
  event.dataTransfer!.dropEffect = "move";
  (event.currentTarget as HTMLElement).classList.add("file-tree__row--drop");
}

function onDragLeave(event: DragEvent) {
  (event.currentTarget as HTMLElement).classList.remove("file-tree__row--drop");
}

async function onDrop(event: DragEvent) {
  (event.currentTarget as HTMLElement).classList.remove("file-tree__row--drop");
  const from = event.dataTransfer?.getData("text/plain");
  if (!from || props.node.kind !== "folder") {
    return;
  }
  try {
    const nextPath = await moveWorkspaceFile(from, props.node.path);
    documents.retargetSessionPath(from, nextPath);
    await folderWorkspace.refreshTree();
  } catch (error) {
    window.alert(String(error));
  }
}
</script>
