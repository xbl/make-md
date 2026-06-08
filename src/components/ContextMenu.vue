<template>
  <div
    v-if="open"
    :ref="setMenuRef"
    class="context-menu"
    :style="{ left: `${x}px`, top: `${y}px` }"
    role="menu"
    tabindex="-1"
  >
    <template v-for="item in items" :key="item.id">
      <div v-if="item.type === 'separator'" class="context-menu__separator" role="separator" />
      <button
        v-else
        type="button"
        class="context-menu__item"
        :disabled="item.disabled"
        role="menuitem"
        @click="handleSelect(item)"
      >
        <span class="context-menu__label">{{ item.label }}</span>
        <span v-if="item.shortcut" class="context-menu__shortcut">{{ item.shortcut }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, watch, type ComponentPublicInstance } from "vue";
import type { ContextMenuActionItem, ContextMenuCloseReason, ContextMenuItem } from "@/lib/context-menu";

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
}>();

const emit = defineEmits<{
  close: [reason: ContextMenuCloseReason];
  select: [item: ContextMenuActionItem];
}>();

let menuElement: HTMLDivElement | null = null;

function handleSelect(item: ContextMenuActionItem) {
  if (item.disabled) {
    return;
  }
  emit("select", item);
  emit("close", "select");
}

function setMenuRef(element: Element | ComponentPublicInstance | null) {
  menuElement = element instanceof HTMLDivElement ? element : null;
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (!props.open || event.key !== "Escape") {
    return;
  }
  event.preventDefault();
  emit("close", "escape");
}

function handleWindowPointerDown(event: MouseEvent) {
  if (!props.open || !menuElement) {
    return;
  }
  if (event.target instanceof Node && menuElement.contains(event.target)) {
    return;
  }
  emit("close", "click-away");
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      menuElement = null;
      return;
    }
    await nextTick();
    menuElement?.focus();
  },
);

onMounted(() => {
  window.addEventListener("keydown", handleWindowKeydown);
  window.addEventListener("pointerdown", handleWindowPointerDown);
  if (props.open) {
    void nextTick(() => {
      menuElement?.focus();
    });
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleWindowKeydown);
  window.removeEventListener("pointerdown", handleWindowPointerDown);
});
</script>
