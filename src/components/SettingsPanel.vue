<template>
  <div v-if="ui.settingsOpen" class="settings-panel" data-testid="settings-panel" @click.self="ui.closeSettings()">
    <section class="settings-panel__dialog" :aria-label="t('settings.title')" role="dialog" aria-modal="true">
      <!-- Left sidebar navigation -->
      <aside class="settings-panel__nav" aria-label="Settings sections">
        <button
          v-for="section in sections"
          :key="section.id"
          type="button"
          class="settings-panel__nav-item"
          :class="{ 'settings-panel__nav-item--active': ui.activeSettingsSection === section.id }"
          :data-settings-section="section.id"
          @click="ui.setActiveSettingsSection(section.id)"
        >
          {{ section.label }}
        </button>
      </aside>

      <!-- Right content area -->
      <div class="settings-panel__content">
        <header class="settings-panel__header">
          <div>
            <h2 class="settings-panel__title">{{ activeSection.title }}</h2>
            <p class="settings-panel__subtitle">{{ activeSection.description }}</p>
          </div>
          <div class="settings-panel__header-actions">
            <button
              v-if="ui.activeSettingsSection === 'shortcuts'"
              class="settings-panel__secondary"
              :title="t('settings.resetAll')"
              type="button"
              @click="resetAll"
            >
              {{ t("settings.resetAll") }}
            </button>
            <button
              class="settings-panel__close"
              type="button"
              :aria-label="t('settings.close')"
              @click="ui.closeSettings()"
            >
              {{ t("settings.close") }}
            </button>
          </div>
        </header>

        <div class="settings-panel__list">
          <!-- General tab -->
          <div v-if="ui.activeSettingsSection === 'general'" class="settings-panel__section">
            <section class="settings-panel__category">
              <h3 class="settings-panel__category-title">{{ t("settings.language.label") }}</h3>
              <article class="settings-panel__row">
                <div class="settings-panel__meta">
                  <h4 class="settings-panel__command">{{ t("settings.language.current") }}</h4>
                  <p class="settings-panel__details">{{ effectiveLocale }}</p>
                </div>

                <div class="settings-panel__actions">
                  <select
                    data-testid="language-select"
                    class="settings-panel__capture"
                    :value="preferences.languagePreference"
                    @change="onLanguageChange"
                  >
                    <option value="system">{{ t("settings.language.system") }}</option>
                    <option value="en">{{ t("settings.language.en") }}</option>
                    <option value="zh-CN">{{ t("settings.language.zhCN") }}</option>
                  </select>
                </div>
              </article>
            </section>
          </div>

          <!-- Shortcuts tab -->
          <div v-else-if="ui.activeSettingsSection === 'shortcuts'" class="settings-panel__section">
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
                    {{ recordingCommandId === command.id ? t("settings.capture") : getDisplay(shortcuts.effectiveChord(command.id)) }}
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
              <h3 class="settings-panel__category-title">{{ t("settings.unavailable") }}</h3>
              <ul class="settings-panel__disabled-list">
                <li v-for="command in disabledCommands" :key="command.id" class="settings-panel__disabled-item">
                  <span>{{ command.label }}</span>
                  <span class="settings-panel__disabled-note">{{ t("settings.unavailableNote") }}</span>
                </li>
              </ul>
            </section>
            <p v-if="recordingHint" class="settings-panel__hint" role="status">{{ recordingHint }}</p>
          </div>

          <!-- AI tab stub -->
          <div v-else-if="ui.activeSettingsSection === 'ai'" class="settings-panel__section">
            <section class="settings-panel__category">
              <h3 class="settings-panel__category-title">AI Settings</h3>
              <p class="settings-panel__hint">AI settings will be folded here in the next task.</p>
            </section>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import { chordToDisplay } from "@/lib/shortcuts/display";
import { eventToChord } from "@/lib/shortcuts/bindings";
import { isSystemReservedChord } from "@/lib/shortcuts/reserved";
import { usePreferencesStore } from "@/stores/preferences";
import { useShortcutsStore } from "@/stores/shortcuts";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const preferences = usePreferencesStore();
const shortcuts = useShortcutsStore();
const { t, effectiveLocale } = useI18n();

const sections = computed(() => [
  { id: "general" as const, label: t("settings.section.general"), title: t("settings.section.general"), description: t("settings.section.general.description") },
  { id: "shortcuts" as const, label: t("settings.section.shortcuts"), title: t("settings.shortcuts.title"), description: t("settings.section.shortcuts.description") },
  { id: "ai" as const, label: t("settings.section.ai"), title: t("settings.section.ai"), description: t("settings.section.ai.description") },
]);

const activeSection = computed(() => {
  return sections.value.find((s) => s.id === ui.activeSettingsSection) ?? sections.value[0];
});

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
    title: t(`settings.group.${category as any}` as any) || (category.charAt(0).toUpperCase() + category.slice(1)),
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
  return chord ? chordToDisplay(chord, platform.value) : t("settings.unassigned");
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

async function onLanguageChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as "system" | "en" | "zh-CN";
  await preferences.setLanguagePreference(value);
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
    recordingHint.value = t("settings.hint.modifier");
    return;
  }

  if (isSystemReservedChord(chord)) {
    recordingHint.value = t("settings.hint.reserved");
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

<style scoped>
.settings-panel__dialog {
  display: flex;
  flex-direction: row;
  width: min(860px, 100%);
  height: min(720px, calc(100vh - 48px));
  overflow: hidden;
}

.settings-panel__nav {
  width: 180px;
  background: var(--bg-secondary, #f7fafc);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 20px 10px;
  gap: 6px;
  flex-shrink: 0;
}

.settings-panel__nav-item {
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  padding: 10px 14px;
  border-radius: var(--radius-md, 6px);
  color: var(--text-secondary);
  font-size: var(--text-sm, 13px);
  font-weight: 500;
  transition: background 0.15s, color 0.15s;
}

.settings-panel__nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.settings-panel__nav-item--active {
  background: var(--bg-active, #edf2f7);
  color: var(--accent, #3182ce);
}

.settings-panel__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
}

.settings-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 22px 22px;
}
</style>