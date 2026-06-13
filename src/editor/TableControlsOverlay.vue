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
    <div class="table-controls-overlay__row-controls">
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
        :disabled="rowCount <= 1"
        @click="emit('action', 'remove-row')"
      >
        ×
      </button>
    </div>

    <!-- Column controls overlaying at the top -->
    <div class="table-controls-overlay__col-controls">
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
        :disabled="columnCount <= 1"
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
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  padding: 2px;
}

.table-controls-overlay__row-controls {
  right: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 4px;
}

.table-controls-overlay__col-controls {
  bottom: calc(100% + 8px);
  left: 50%;
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
  border-radius: 2px;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #4a5568);
  min-width: 20px;
  min-height: 20px;
}

.table-controls-overlay button:hover:not(:disabled) {
  background: var(--bg-hover, #edf2f7);
  color: var(--text-primary, #1a202c);
}

.table-controls-overlay button:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>