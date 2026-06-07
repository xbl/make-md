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
      <span class="file-tree__chevron" :class="{ 'file-tree__chevron--open': expanded }">›</span>
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

    <div
      v-if="menu.open"
      class="file-tree__menu"
      :style="{ top: `${menu.y}px`, left: `${menu.x}px` }"
      @click.stop
    >
      <button v-if="menu.kind === 'folder'" type="button" @click="createFile">New File</button>
      <button v-if="menu.kind === 'file'" type="button" @click="renameFile">Rename</button>
      <button v-if="menu.kind === 'file'" type="button" @click="deleteFile">Delete</button>
      <button type="button" @click="revealFile">Reveal in Finder</button>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive } from "vue";
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

const menu = reactive({
  open: false,
  x: 0,
  y: 0,
  kind: "file" as "file" | "folder",
});

const expanded = computed(() => folderWorkspace.isExpanded(props.node.path));

function closeMenu() {
  menu.open = false;
}

function toggle() {
  folderWorkspace.toggleExpanded(props.node.path);
  folderWorkspace.setSelectedPath(props.node.path);
}

function openFile() {
  folderWorkspace.setSelectedPath(props.node.path);
  emit("open-file", props.node.path);
}

function openMenu(event: MouseEvent, kind: "file" | "folder") {
  menu.open = true;
  menu.x = event.clientX;
  menu.y = event.clientY;
  menu.kind = kind;
}

async function createFile() {
  closeMenu();
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
  closeMenu();
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
  closeMenu();
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
  closeMenu();
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

onMounted(() => window.addEventListener("click", closeMenu));
onBeforeUnmount(() => window.removeEventListener("click", closeMenu));
</script>
