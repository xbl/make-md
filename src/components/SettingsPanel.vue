<template>
  <div v-if="ui.settingsOpen" class="settings-panel" data-testid="settings-panel" @click.self="ui.closeSettings()">
    <section class="settings-panel__dialog" :aria-label="t('settings.title')" role="dialog" aria-modal="true">
      <!-- Left sidebar navigation -->
      <aside class="settings-panel__nav" aria-label="Settings sections">
        <div class="settings-panel__nav-header">
          <span class="settings-panel__nav-logo">make-md</span>
          <span class="settings-panel__nav-version">v0.1.0</span>
        </div>
        <div class="settings-panel__nav-links">
          <button
            v-for="section in sections"
            :key="section.id"
            type="button"
            class="settings-panel__nav-item"
            :class="{ 'settings-panel__nav-item--active': ui.activeSettingsSection === section.id }"
            :data-settings-section="section.id"
            @click="ui.setActiveSettingsSection(section.id)"
          >
            <span class="settings-panel__nav-dot"></span>
            {{ section.label }}
          </button>
        </div>
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
              class="settings-panel__secondary-action"
              type="button"
              :title="t('settings.resetAll')"
              @click="resetAll"
            >
              {{ t("settings.resetAll") }}
            </button>
            <button
              class="settings-panel__close-action"
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
                    class="settings-panel__select"
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
                  <!-- Typewriter-style keyboard keycap -->
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
                    class="settings-panel__reset-btn"
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

          <!-- AI tab -->
          <div v-else-if="ui.activeSettingsSection === 'ai'" class="settings-panel__section">
            <section class="settings-panel__category">
              <h3 class="settings-panel__category-title">Provider</h3>

              <article class="settings-panel__row">
                <div class="settings-panel__meta">
                  <h4 class="settings-panel__command">{{ t("settings.ai.provider.label") }}</h4>
                  <p class="settings-panel__details">{{ t("settings.ai.provider.description") }}</p>
                </div>
                <div class="settings-panel__actions">
                  <select v-model="ai.activeProvider" class="settings-panel__select">
                    <option value="openai">OpenAI</option>
                    <option value="deepseek">DeepSeek</option>
                  </select>
                </div>
              </article>

              <h3 class="settings-panel__category-title" style="margin-top: 12px;">API Keys</h3>

              <article class="settings-panel__row settings-panel__row--provider" v-for="provider in providerList" :key="provider.id">
                <div class="settings-panel__meta">
                  <h4 class="settings-panel__command">
                    <span class="ai-status-dot" :class="{ 'ai-status-dot--ok': keyTestResult[provider.id] === 'success', 'ai-status-dot--fail': keyTestResult[provider.id] === 'fail' }"></span>
                    {{ provider.label }}
                  </h4>
                  <p class="settings-panel__details">Default: {{ ai.providers[provider.id].model }}</p>
                </div>
                <div class="settings-panel__actions ai-provider-actions">
                  <input
                    type="password"
                    v-model="apiKeys[provider.id]"
                    placeholder="sk-..."
                    class="settings-panel__capture ai-key-input"
                    @input="keyTestResult[provider.id] = null"
                  />
                  <button class="settings-panel__secondary-action" type="button" @click="updateKey(provider.id)">
                    Save
                  </button>
                  <button
                    class="settings-panel__secondary-action"
                    type="button"
                    :disabled="testingKey[provider.id]"
                    @click="testKey(provider.id)"
                  >
                    {{ testingKey[provider.id] ? "…" : t("ai.testKey") }}
                  </button>
                </div>
                <div class="ai-provider-config">
                  <input
                    type="text"
                    :list="`model-list-${provider.id}`"
                    :value="ai.providers[provider.id].model"
                    placeholder="Model"
                    class="settings-panel__capture ai-config-input"
                    @change="updateModel(provider.id, ($event.target as HTMLInputElement).value)"
                  />
                  <datalist :id="`model-list-${provider.id}`">
                    <option v-for="m in MODEL_OPTIONS[provider.id]" :key="m" :value="m" />
                  </datalist>
                  <input
                    type="text"
                    :value="ai.providers[provider.id].baseUrl"
                    :placeholder="DEFAULT_BASE_URLS[provider.id]"
                    class="settings-panel__capture ai-config-input"
                    @change="updateBaseUrl(provider.id, ($event.target as HTMLInputElement).value)"
                  />
                </div>
              </article>
            </section>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import { useI18n } from "@/composables/useI18n";
import { chordToDisplay } from "@/lib/shortcuts/display";
import { eventToChord } from "@/lib/shortcuts/bindings";
import { isSystemReservedChord } from "@/lib/shortcuts/reserved";
import { usePreferencesStore } from "@/stores/preferences";
import { useShortcutsStore } from "@/stores/shortcuts";
import { useUiStore } from "@/stores/ui";
import { useAiStore } from "@/stores/ai";
import { loadApiKey, saveApiKey } from "@/lib/file-service";
import { toastSuccess, toastError } from "@/composables/useToast";

const ui = useUiStore();
const preferences = usePreferencesStore();
const shortcuts = useShortcutsStore();
const ai = useAiStore();
const { t, effectiveLocale } = useI18n();

async function loadKeys() {
  for (const provider of providerList) {
    const key = await loadApiKey(provider.id);
    if (key) {
      apiKeys.value[provider.id] = key;
    }
  }
}

async function updateKey(provider: string) {
  const key = apiKeys.value[provider];
  if (key) {
    await saveApiKey(provider, key);
    keyTestResult.value[provider] = null;
  }
}

function updateModel(provider: string, model: string) {
  const id = provider as keyof typeof ai.providers;
  if (model.trim()) {
    ai.providers[id].model = model.trim();
  }
}

function updateBaseUrl(provider: string, baseUrl: string) {
  const id = provider as keyof typeof ai.providers;
  ai.providers[id].baseUrl = baseUrl.trim();
}

async function testKey(providerId: string) {
  testingKey.value[providerId] = true;
  keyTestResult.value[providerId] = null;

  try {
    let apiKey = (apiKeys.value[providerId] ?? "").trim();
    if (!apiKey) {
      apiKey = ((await loadApiKey(providerId)) ?? "").trim();
    }
    if (!apiKey) {
      keyTestResult.value[providerId] = "fail";
      toastError(t("ai.testKeyFail"));
      return;
    }

    const config = ai.providers[providerId as keyof typeof ai.providers];
    const baseUrl = config.baseUrl.trim() || DEFAULT_BASE_URLS[providerId];
    const model = config.model.trim();

    console.log(`[testKey] provider=${providerId} baseUrl=${baseUrl} model=${model} keyLen=${apiKey.length}`);

    const { createOpenAI } = await import("@ai-sdk/openai");
    const { generateText } = await import("ai");

    const openai = createOpenAI({ apiKey, baseURL: baseUrl });

    await generateText({
      model: openai.chat(model),
      prompt: "Hi",
    });

    keyTestResult.value[providerId] = "success";
    toastSuccess(t("ai.testKeySuccess"));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("AI key test failed:", message, e);
    keyTestResult.value[providerId] = "fail";
    toastError(t("ai.testKeyFail"));
  } finally {
    testingKey.value[providerId] = false;
  }
}

onMounted(() => {
  loadKeys();
});

const sections = computed(() => [
  { id: "general" as const, label: t("settings.section.general"), title: t("settings.section.general"), description: t("settings.section.general.description") },
  { id: "shortcuts" as const, label: t("settings.section.shortcuts"), title: t("settings.shortcuts.title"), description: t("settings.section.shortcuts.description") },
  { id: "ai" as const, label: t("settings.section.ai"), title: t("settings.section.ai"), description: t("settings.section.ai.description") },
]);

const activeSection = computed(() => {
  return sections.value.find((s) => s.id === ui.activeSettingsSection) ?? sections.value[0];
});

const providerList = [
  { id: "openai" as const, label: "OpenAI" },
  { id: "deepseek" as const, label: "DeepSeek" },
];

const DEFAULT_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com",
};

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo", "o1", "o1-mini", "o3-mini"],
  deepseek: ["deepseek-chat", "deepseek-reasoner"],
};

const apiKeys = ref<Record<string, string>>({});
const testingKey = ref<Record<string, boolean>>({});
const keyTestResult = ref<Record<string, "success" | "fail" | null>>({});
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
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.1));
  overflow: hidden;
  font-family: var(--font-ui, system-ui, sans-serif);
}

/* Left sidebar navigation */
.settings-panel__nav {
  width: 220px;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  flex-shrink: 0;
  box-sizing: border-box;
}

.settings-panel__nav-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 32px;
  padding-left: 8px;
}

.settings-panel__nav-logo {
  font-family: var(--font-editor, serif);
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.settings-panel__nav-version {
  font-size: 10px;
  color: var(--text-faint);
  font-family: monospace;
}

.settings-panel__nav-links {
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-panel__nav-dot {
  width: 5px;
  height: 5px;
  background: transparent;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.settings-panel__nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.settings-panel__nav-item--active {
  background: var(--bg-active);
  color: var(--accent, #3182ce);
}

.settings-panel__nav-item--active .settings-panel__nav-dot {
  background: var(--accent, #3182ce);
  box-shadow: 0 0 6px var(--accent);
}

/* Right content area */
.settings-panel__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  background: var(--bg-elevated);
}

.settings-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 28px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
}

.settings-panel__title {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--text-primary);
  letter-spacing: -0.3px;
}

.settings-panel__subtitle {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: var(--text-sm, 13px);
}

.settings-panel__header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.settings-panel__secondary-action,
.settings-panel__close-action {
  font-family: inherit;
  font-size: var(--text-sm, 13px);
  font-weight: 500;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.settings-panel__secondary-action:hover,
.settings-panel__close-action:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
  color: var(--text-primary);
}

.settings-panel__close-action {
  border-color: transparent;
  background: var(--bg-hover);
  color: var(--text-primary);
}

.settings-panel__close-action:hover {
  background: color-mix(in srgb, var(--bg-hover) 85%, var(--accent) 15%);
}

.settings-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px 28px;
  box-sizing: border-box;
}

.settings-panel__category {
  margin-bottom: 28px;
}

.settings-panel__category:last-child {
  margin-bottom: 0;
}

.settings-panel__category-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 12px 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border);
  letter-spacing: 0.2px;
}

/* Settings Row - Clean and Spacious Card Layout */
.settings-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 12px 14px;
  margin-bottom: 8px;
  background: var(--bg-paper);
  border: 1px solid var(--border);
  border-radius: 8px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.settings-panel__row:hover {
  border-color: var(--border-strong);
}

.settings-panel__meta {
  flex: 1;
  min-width: 0;
}

.settings-panel__command {
  margin: 0 0 4px 0;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.settings-panel__details {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.settings-panel__actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* Custom Dropdown select */
.settings-panel__select {
  font-family: inherit;
  font-size: var(--text-sm, 13px);
  padding: 6px 32px 6px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  appearance: none;
  cursor: pointer;
  transition: border-color 0.15s ease;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%235c5c57'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 12px;
}

.settings-panel__select:hover {
  border-color: var(--border-strong);
}

.settings-panel__select:focus {
  border-color: var(--accent);
  outline: none;
}

/* Mechanical Typewriter-style Keycaps */
.settings-panel__capture {
  font-family: var(--font-monospace, monospace);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-bottom: 2px solid var(--border-strong);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  min-width: 100px;
  text-align: center;
  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
  transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  letter-spacing: -0.2px;
}

.settings-panel__capture:hover {
  transform: translateY(1px);
  border-bottom-width: 1px;
  background: var(--bg-hover);
  box-shadow: none;
}

/* Pulsing Recording Amber State */
.settings-panel__capture--recording {
  border-color: #d69e2e !important;
  border-bottom: 2px solid #b7791f !important;
  color: #b7791f !important;
  background: color-mix(in srgb, var(--bg-elevated) 90%, #ecc94b) !important;
  animation: pulse-recording 1.5s infinite ease-in-out;
  font-weight: 600;
}

@keyframes pulse-recording {
  0%, 100% {
    box-shadow: 0 0 0 0px rgba(214, 158, 46, 0.2);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(214, 158, 46, 0.2);
  }
}

.settings-panel__reset-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: var(--text-sm, 13px);
  padding: 6px 8px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.settings-panel__reset-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* AI provider status dot */
.ai-status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--text-faint);
  margin-right: 6px;
  vertical-align: middle;
  transition: background 0.3s ease;
}

.ai-status-dot--ok {
  background: #7a9a60;
}

:root[data-theme="dark"] .ai-status-dot--ok {
  background: #8db870;
}

.ai-status-dot--fail {
  background: #c47070;
}

:root[data-theme="dark"] .ai-status-dot--fail {
  background: #cc7777;
}

.ai-provider-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ai-key-input {
  width: 200px;
}

.ai-provider-config {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
  width: 100%;
}

.ai-config-input {
  flex: 1;
  min-width: 0;
}

/* Expand provider row to wrap config */
.settings-panel__row--provider {
  flex-wrap: wrap;
}

.settings-panel__row--provider .settings-panel__meta {
  flex: 1 1 auto;
}

.settings-panel__row--provider .ai-provider-actions {
  flex: 0 0 auto;
}

.settings-panel__hint {
  font-size: 12px;
  color: #dd6b20;
  background: color-mix(in srgb, var(--bg-elevated) 95%, #ecc94b);
  border: 1px solid color-mix(in srgb, var(--border) 80%, #ecc94b);
  border-radius: 6px;
  padding: 8px 12px;
  margin-top: 16px;
}

/* Custom Scrollbar for list */
.settings-panel__list::-webkit-scrollbar {
  width: 6px;
}

.settings-panel__list::-webkit-scrollbar-track {
  background: transparent;
}

.settings-panel__list::-webkit-scrollbar-thumb {
  background: var(--border-strong);
  border-radius: 10px;
}

.settings-panel__list::-webkit-scrollbar-thumb:hover {
  background: var(--text-faint);
}
</style>