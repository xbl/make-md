<template>
  <div
    v-if="visible"
    class="table-controls-overlay"
    data-testid="table-controls-overlay"
    :style="{
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`
    }"
  >
    <!-- Row controls overlaying on the left -->
    <div
      class="table-controls-overlay__row-controls"
      :style="{ top: `${cellRect.top - top + cellRect.height / 2}px` }"
    >
      <button
        type="button"
        data-action="insert-row-above"
        title="Insert row above"
        @click="emit('action', 'insert-row-above')"
      >
        +↑
      </button>
      <button
        type="button"
        data-action="insert-row-below"
        title="Insert row below"
        @click="emit('action', 'insert-row-below')"
      >
        +↓
      </button>
      <button
        type="button"
        data-action="remove-row"
        title="Remove row"
        @click="emit('action', 'remove-row')"
      >
        ×
      </button>
    </div>

    <!-- Column controls overlaying at the top -->
    <div
      class="table-controls-overlay__col-controls"
      :style="{ left: `${cellRect.left - left + cellRect.width / 2}px` }"
    >
      <button
        type="button"
        data-action="insert-column-left"
        title="Insert column left"
        @click="emit('action', 'insert-column-left')"
      >
        +←
      </button>
      <button
        type="button"
        data-action="insert-column-right"
        title="Insert column right"
        @click="emit('action', 'insert-column-right')"
      >
        +→
      </button>
      <button
        type="button"
        data-action="remove-column"
        title="Remove column"
        @click="emit('action', 'remove-column')"
      >
        ×
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { TableAction } from "@/editor/table-editing";

defineProps<{
  visible: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  rowIndex: number;
  columnIndex: number;
  rowCount: number;
  columnCount: number;
  cellRect: { left: number; top: number; width: number; height: number };
}>();

const emit = defineEmits<{
  action: [action: TableAction];
}>();
</script>

<style scoped>
.table-controls-overlay {
  position: absolute;
  pointer-events: none;
  z-index: 10;
}

.table-controls-overlay__row-controls,
.table-controls-overlay__col-controls {
  position: absolute;
  pointer-events: auto;
  display: flex;
  background: #000;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.30);
  padding: 2px;
}

.table-controls-overlay__row-controls {
  right: calc(100% + 8px);
  transform: translateY(-50%);
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.table-controls-overlay__col-controls {
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.table-controls-overlay button {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  min-width: 20px;
  min-height: 20px;
}

.table-controls-overlay button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.table-controls-overlay button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>