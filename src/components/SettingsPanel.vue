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
        <article
          v-for="command in shortcuts.catalog"
          :key="command.id"
          class="settings-panel__row"
          :data-command-id="command.id"
        >
          <div class="settings-panel__meta">
            <h3 class="settings-panel__command">{{ command.label }}</h3>
            <p class="settings-panel__details">{{ command.category }} · {{ command.scope }}</p>
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
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { chordToDisplay } from "@/lib/shortcuts/display";
import { eventToChord } from "@/lib/shortcuts/bindings";
import { useShortcutsStore } from "@/stores/shortcuts";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const shortcuts = useShortcutsStore();
const recordingCommandId = ref<string | null>(null);
const platform = computed(() => (navigator.userAgent.includes("Mac") ? "darwin" : "win32"));

function getDisplay(chord: string | null) {
  return chord ? chordToDisplay(chord, platform.value) : "Unassigned";
}

function startRecording(commandId: string) {
  recordingCommandId.value = commandId;
}

function resetAll() {
  shortcuts.resetAll();
  recordingCommandId.value = null;
}

function captureChord(commandId: string, event: KeyboardEvent) {
  if (recordingCommandId.value !== commandId) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    recordingCommandId.value = null;
    return;
  }

  const chord = eventToChord(event);
  if (!chord) {
    return;
  }

  event.preventDefault();
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
}
</script>
