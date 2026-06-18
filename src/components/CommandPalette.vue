<template>
  <div
    v-if="ui.commandPaletteOpen"
    class="command-palette command-palette--open"
    @click.self="ui.closeCommandPalette()"
    @keydown.capture="handleContainerKeydown"
  >
    <div class="command-palette__panel" role="dialog" :aria-label="t('commandPalette.title')" tabindex="-1">
      <input
        ref="inputRef"
        v-model="query"
        class="command-palette__input"
        type="text"
        :placeholder="t('commandPalette.placeholder')"
        @keydown="handleKeydown"
      />
      <ul class="command-palette__list">
        <li v-for="(command, index) in filtered" :key="command.id">
          <button
            type="button"
            class="command-palette__item"
            :class="{ 'command-palette__item--active': index === activeIndex }"
            :disabled="!command.enabled"
            @click="runCommand(command)"
          >
            <span>{{ command.label }}</span>
            <span v-if="command.shortcut" class="command-palette__shortcut">{{ command.shortcut }}</span>
          </button>
        </li>
        <li v-if="filtered.length === 0" class="command-palette__empty">{{ t("commandPalette.empty") }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { createAppCommandRuntime, type PaletteCommand } from "@/lib/app-commands";
import { pickFolder } from "@/lib/file-service";
import { useAiStore } from "@/stores/ai";
import { useDocumentsStore } from "@/stores/documents";
import { useEditorStore } from "@/stores/editor";
import { useFolderWorkspaceStore } from "@/stores/folder-workspace";
import { usePreferencesStore } from "@/stores/preferences";
import { useShortcutsStore } from "@/stores/shortcuts";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const ai = useAiStore();
const documents = useDocumentsStore();
const editorStore = useEditorStore();
const folderWorkspace = useFolderWorkspaceStore();
const preferences = usePreferencesStore();
const shortcuts = useShortcutsStore();
const { t } = useI18n();
const query = ref("");
const activeIndex = ref(0);
const inputRef = ref<HTMLInputElement | null>(null);

function canRunEditorCommand(commandId: string) {
  if (commandId === "view.outline" || commandId === "view.files") {
    return true;
  }

  return Boolean(editorStore.view);
}

const runtime = createAppCommandRuntime({
  openFile: () => documents.openFileDialog(),
  openFolder: async () => {
    const path = await pickFolder();
    if (path) {
      await folderWorkspace.setRootPath(path);
      folderWorkspace.setActiveTab("files");
    }
  },
  createNew: () => documents.createNewDocument(),
  save: () => documents.saveActiveFile(),
  saveAs: () => documents.saveAsDialog(),
  exportHtml: () => documents.exportActiveHtml(),
  exportPdf: () => documents.exportActivePdf(),
  exportWord: () => documents.exportActiveWord(),
  openFind: () => ui.openFindReplace("find"),
  openReplace: () => ui.openFindReplace("replace"),
  toggleSidebar: () => ui.toggleSidebar(),
  toggleFocusMode: () => ui.toggleFocusMode(),
  toggleSourceMode: () => ui.toggleSourceMode(),
  openSettings: () => ui.openSettings("general"),
  openAiSettings: () => ui.openSettings("ai"),
  openAiRewriteSelection: () => { ai.toolbarMode = "selection"; },
  openAiRewriteDocument: () => { ai.toolbarMode = "document"; },
  openCommandPalette: () => ui.openCommandPalette(),
  closeTab: () => (documents.activeSessionId ? documents.closeSession(documents.activeSessionId) : Promise.resolve(true)),
  canRunEditorCommand,
  runEditorCommand: (commandId: string) => {
    if (commandId === "view.outline") {
      folderWorkspace.setActiveTab("outline");
      return true;
    }
    if (commandId === "view.files") {
      folderWorkspace.setActiveTab("files");
      return true;
    }
    if (!editorStore.view) {
      return false;
    }
    window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId } }));
    return true;
  },
});

const commands = computed<PaletteCommand[]>(() =>
  runtime.getPaletteCommands(preferences.effectiveLocale, (commandId) => shortcuts.effectiveChord(commandId)),
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

async function runCommand(command: PaletteCommand) {
  if (!command.enabled) {
    return;
  }
  ui.closeCommandPalette();
  await command.run();
}

function handleContainerKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    ui.closeCommandPalette();
    return;
  }
}

function handleKeydown(event: KeyboardEvent) {
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
