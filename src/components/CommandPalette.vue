<template>
  <div
    v-if="ui.commandPaletteOpen"
    class="command-palette command-palette--open"
    @click.self="ui.toggleCommandPalette()"
  >
    <div class="command-palette__panel" role="dialog" aria-label="Command palette">
      <input
        ref="inputRef"
        v-model="query"
        class="command-palette__input"
        type="text"
        placeholder="Type a command…"
        @keydown="handleKeydown"
      />
      <ul class="command-palette__list">
        <li v-for="(command, index) in filtered" :key="command.id">
          <button
            type="button"
            class="command-palette__item"
            :class="{ 'command-palette__item--active': index === activeIndex }"
            @click="runCommand(command)"
          >
            <span>{{ command.label }}</span>
            <span v-if="command.shortcut" class="command-palette__shortcut">{{ command.shortcut }}</span>
          </button>
        </li>
        <li v-if="filtered.length === 0" class="command-palette__empty">No matching commands</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { createAppCommands, type AppCommand } from "@/lib/app-commands";
import { useDocumentsStore } from "@/stores/documents";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const documents = useDocumentsStore();
const query = ref("");
const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

const commands = computed(() =>
  createAppCommands({
    openFile: () => documents.openFileDialog(),
    createNew: () => documents.createNewDocument(),
    save: () => documents.saveActiveFile(),
    saveAs: () => documents.saveAsDialog(),
    exportHtml: () => documents.exportActiveHtml(),
    toggleSidebar: () => ui.toggleSidebar(),
    toggleFocusMode: () => ui.toggleFocusMode(),
    toggleTheme: () => ui.toggleTheme(),
  }),
);

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    return commands.value;
  }
  return commands.value.filter((command) => command.label.toLowerCase().includes(q));
});

watch(
  () => ui.commandPaletteOpen,
  async (open) => {
    if (open) {
      query.value = "";
      activeIndex.value = 0;
      await nextTick();
      inputRef.value?.focus();
    }
  },
);

watch(filtered, () => {
  activeIndex.value = 0;
});

async function runCommand(command: AppCommand) {
  ui.commandPaletteOpen = false;
  await command.run();
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    ui.commandPaletteOpen = false;
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    activeIndex.value = Math.min(activeIndex.value + 1, filtered.value.length - 1);
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, 0);
    return;
  }
  if (event.key === "Enter" && filtered.value[activeIndex.value]) {
    event.preventDefault();
    void runCommand(filtered.value[activeIndex.value]);
  }
}
</script>
