<template>
  <div v-if="ui.settingsOpen" class="settings-panel" data-testid="settings-panel" @click.self="ui.closeSettings()">
    <section class="settings-panel__dialog" aria-label="Preferences" role="dialog" aria-modal="true">
      <header class="settings-panel__header">
        <div>
          <h2 class="settings-panel__title">Preferences</h2>
          <p class="settings-panel__subtitle">Customize keyboard shortcuts for app and editor commands.</p>
        </div>
        <div class="settings-panel__header-actions">
          <button
            class="settings-panel__secondary"
            title="Reset all shortcuts"
            type="button"
            @click="resetAll"
          >
            Reset All
          </button>
          <button class="settings-panel__close" type="button" aria-label="Close preferences" @click="ui.closeSettings()">
            Close
          </button>
        </div>
      </header>

      <div class="settings-panel__list">
        <section
          v-for="group in commandGroups"
          :key="group.category"
          class="settings-panel__category"
        >
          <h3 class="settings-panel__category-title">{{ group.title }}</h3>
          <article
            v-for="command in group.commands"
            :key="command.id"
            class="settings-panel__row"
            :data-command-id="command.id"
          >
            <div class="settings-panel__meta">
              <h4 class="settings-panel__command">{{ command.label }}</h4>
              <p class="settings-panel__details">{{ command.scope }}</p>
            </div>

            <div class="settings-panel__actions">
              <button
                class="settings-panel__capture"
                type="button"
                :title="`Shortcut for ${command.label}`"
                :class="{ 'settings-panel__capture--recording': recordingCommandId === command.id }"
                @click="startRecording(command.id)"
                @keydown="captureChord(command.id, $event)"
              >
                {{ recordingCommandId === command.id ? "Type shortcut…" : getDisplay(shortcuts.effectiveChord(command.id)) }}
              </button>
              <button
                class="settings-panel__secondary"
                title="Reset shortcut"
                type="button"
                @click="shortcuts.resetCommand(command.id)"
              >
                Reset
              </button>
            </div>
          </article>
        </section>

        <section v-if="disabledCommands.length" class="settings-panel__category settings-panel__category--disabled">
          <h3 class="settings-panel__category-title">Unavailable commands</h3>
          <ul class="settings-panel__disabled-list">
            <li v-for="command in disabledCommands" :key="command.id" class="settings-panel__disabled-item">
              <span>{{ command.label }}</span>
              <span class="settings-panel__disabled-note">Not currently available</span>
            </li>
          </ul>
        </section>
        <p v-if="recordingHint" class="settings-panel__hint" role="status">{{ recordingHint }}</p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { chordToDisplay } from "@/lib/shortcuts/display";
import { eventToChord } from "@/lib/shortcuts/bindings";
import { isSystemReservedChord } from "@/lib/shortcuts/reserved";
import { useShortcutsStore } from "@/stores/shortcuts";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const shortcuts = useShortcutsStore();
const recordingCommandId = ref<string | null>(null);
const recordingHint = ref("");
const platform = computed(() => (navigator.userAgent.includes("Mac") ? "darwin" : "win32"));
const enabledCommands = computed(() => shortcuts.catalog.filter((command) => command.enabled));
const disabledCommands = computed(() => shortcuts.catalog.filter((command) => !command.enabled));
const commandGroups = computed(() => {
  const groups = new Map<string, typeof enabledCommands.value>();
  for (const command of enabledCommands.value) {
    const group = groups.get(command.category) ?? [];
    group.push(command);
    groups.set(command.category, group);
  }

  return Array.from(groups.entries()).map(([category, commands]) => ({
    category,
    title: category.charAt(0).toUpperCase() + category.slice(1),
    commands,
  }));
});

watch(
  () => ui.settingsOpen,
  (open) => {
    if (!open) {
      recordingCommandId.value = null;
      recordingHint.value = "";
      ui.stopSettingsShortcutRecording();
    }
  },
);

function getDisplay(chord: string | null) {
  return chord ? chordToDisplay(chord, platform.value) : "Unassigned";
}

function startRecording(commandId: string) {
  recordingCommandId.value = commandId;
  recordingHint.value = "";
  ui.startSettingsShortcutRecording();
}

function resetAll() {
  shortcuts.resetAll();
  recordingCommandId.value = null;
  recordingHint.value = "";
  ui.stopSettingsShortcutRecording();
}

function captureChord(commandId: string, event: KeyboardEvent) {
  if (recordingCommandId.value !== commandId) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (event.key === "Escape") {
    recordingCommandId.value = null;
    recordingHint.value = "";
    ui.stopSettingsShortcutRecording();
    return;
  }

  const chord = eventToChord(event);
  if (!chord) {
    recordingHint.value = "Use a shortcut with modifier keys.";
    return;
  }

  if (isSystemReservedChord(chord)) {
    recordingHint.value = "This shortcut is reserved by the system and cannot be reassigned.";
    return;
  }

  recordingHint.value = "";
  const conflict = shortcuts.checkConflict(commandId, chord);
  if (conflict) {
    const confirmed = window.confirm(`Replace shortcut used by ${conflict.label}?`);
    if (!confirmed) {
      return;
    }
    shortcuts.applyOverride(conflict.commandId, null);
  }

  shortcuts.applyOverride(commandId, chord);
  recordingCommandId.value = null;
  ui.stopSettingsShortcutRecording();
}
</script>
