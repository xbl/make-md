<template>
  <svg
    class="file-icon"
    :class="iconClass"
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <!-- Folder Closed -->
    <template v-if="kind === 'folder' && !open">
      <path d="M1.5 6V4.5a1 1 0 0 1 1-1h2.2l1.6 2h6.2a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V6z" />
    </template>

    <!-- Folder Open -->
    <template v-else-if="kind === 'folder' && open">
      <path d="M1.5 6V4.5a1 1 0 0 1 1-1h2.2l1.6 2h6.2a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V6z" />
      <path d="M1.5 6h3.5l1-1.5h5.5v6" opacity="0.5" />
    </template>

    <!-- Markdown file -->
    <template v-else-if="ext === 'md' || ext === 'markdown'">
      <path d="M2.5 2.5h7l4 4v7a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-11z" />
      <path d="M9.5 2.5v3.5a.5.5 0 0 0 .5.5h3.5" />
      <path d="M5 8.5h6M5 10.5h4M5 12.5h2" />
    </template>

    <!-- PDF file -->
    <template v-else-if="ext === 'pdf'">
      <path d="M2.5 2.5h7l4 4v7a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-11z" />
      <path d="M9.5 2.5v3.5a.5.5 0 0 0 .5.5h3.5" />
      <path d="M4.5 11v-3h1.3a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-1.3M8 11l1-3h1l1 3M9 10h1" />
    </template>

    <!-- Word file -->
    <template v-else-if="ext === 'docx' || ext === 'doc'">
      <path d="M2.5 2.5h7l4 4v7a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-11z" />
      <path d="M9.5 2.5v3.5a.5.5 0 0 0 .5.5h3.5" />
      <path d="M5 9l1.5 3L8 9M5.5 10.5h2" />
    </template>

    <!-- Image file -->
    <template v-else-if="isImage">
      <path d="M2.5 2.5h7l4 4v7a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-11z" />
      <path d="M9.5 2.5v3.5a.5.5 0 0 0 .5.5h3.5" />
      <circle cx="6" cy="9" r="1" />
      <path d="M2.5 13l3-3.5 2 2L11 8l2.5 3" />
    </template>

    <!-- Generic file -->
    <template v-else>
      <path d="M2.5 2.5h7l4 4v7a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-11z" />
      <path d="M9.5 2.5v3.5a.5.5 0 0 0 .5.5h3.5" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  kind: "file" | "folder";
  ext?: string;
  open?: boolean;
}>();

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);

const isImage = computed(() => {
  if (!props.ext) return false;
  return IMAGE_EXTS.has(props.ext.toLowerCase());
});

const iconClass = computed(() => {
  const parts: string[] = ["file-icon"];
  if (props.kind === "folder") {
    parts.push("file-icon--folder");
    if (props.open) parts.push("file-icon--folder-open");
  } else {
    parts.push("file-icon--file");
    if (props.ext) parts.push(`file-icon--ext-${props.ext.toLowerCase()}`);
  }
  return parts;
});
</script>
