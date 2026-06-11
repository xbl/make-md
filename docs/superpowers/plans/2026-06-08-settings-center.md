# Settings Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split `Preferences` and `AI Settings` overlays with one localized settings center that groups configuration into `General`, `Shortcuts`, and `AI`.

**Architecture:** Evolve the existing `SettingsPanel.vue` into the single source of truth for settings UI, move section selection into the UI store, and route all settings entry points through that store. Fold AI provider controls into the unified panel while preserving existing shortcut capture and AI key-management behavior, then localize the new copy through the current i18n catalogs.

**Tech Stack:** Vue 3, Pinia, TypeScript, Tauri, Vitest

**Spec:** `docs/superpowers/specs/2026-06-08-settings-center-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/components/SettingsPanel.vue` | Unified settings center layout, left navigation, general/shortcut/AI sections |
| `src/components/AiSettingsPanel.vue` | Remove after AI content is folded into unified settings |
| `src/stores/ui.ts` | Settings center open state, active section state, section-aware open helpers |
| `src/stores/ai.ts` | Delegate settings opening to the unified UI store and remove separate overlay state |
| `src/layout/AppShell.vue` | Mount only the unified settings center and route app command runtime to it |
| `src/components/CommandPalette.vue` | Route both settings commands into the unified settings center |
| `src/i18n/locales/en.ts` | English settings-center and AI strings |
| `src/i18n/locales/zh-CN.ts` | Chinese settings-center and AI strings |
| `src/composables/useI18n.ts` | Existing runtime bridge, reused by the unified settings center |
| `tests/unit/settings-panel.spec.ts` | Unified settings center rendering, navigation, locale, shortcut and AI assertions |
| `tests/unit/ai-settings-panel.spec.ts` | Remove or merge coverage into unified settings tests |
| `tests/unit/app-shell.spec.ts` | Startup and escape behavior after dropping the separate AI overlay |
| `docs/product/feature-list.md` | Mark settings-center refactor / AI settings grouping status changes |

### Task 1: Add section-aware settings-center state to the UI store

**Files:**
- Modify: `src/stores/ui.ts`
- Test: `tests/unit/settings-panel.spec.ts`
- Test: `tests/unit/app-shell.spec.ts`

- [ ] **Step 1: Write the failing store-level expectations in settings and shell tests**

```ts
// tests/unit/settings-panel.spec.ts
it("opens the unified settings center to the requested section", async () => {
  const { pinia, ui } = mountPanel();
  ui.openSettings("ai");

  const wrapper = mount(SettingsPanel, {
    global: {
      plugins: [pinia],
    },
  });

  expect(wrapper.text()).toContain("AI Settings");
  expect(wrapper.find('[data-settings-section="ai"]').classes()).toContain("settings-panel__nav-item--active");
});

// tests/unit/app-shell.spec.ts
it("keeps the unified settings center open when Escape exits shortcut capture", async () => {
  const { wrapper, ui } = mountShell();
  ui.openSettings("shortcuts");

  const recordButton = wrapper.find('[data-command-id="format.bold"] .settings-panel__capture');
  await recordButton.trigger("click");
  await wrapper.trigger("keydown", { key: "Escape" });

  expect(ui.settingsOpen).toBe(true);
  expect(ui.activeSettingsSection).toBe("shortcuts");
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/settings-panel.spec.ts tests/unit/app-shell.spec.ts`
Expected: FAIL because `openSettings("ai")` and `activeSettingsSection` do not exist yet.

- [ ] **Step 3: Add settings section state and section-aware open helpers**

```ts
// src/stores/ui.ts
export type SettingsSection = "general" | "shortcuts" | "ai";

export const useUiStore = defineStore("ui", {
  state: () => ({
    commandPaletteOpen: false,
    settingsOpen: false,
    activeSettingsSection: "general" as SettingsSection,
    settingsShortcutRecording: false,
    // ...
  }),
  actions: {
    openSettings(section?: SettingsSection) {
      if (section) {
        this.activeSettingsSection = section;
      }
      this.settingsOpen = true;
    },
    setActiveSettingsSection(section: SettingsSection) {
      this.activeSettingsSection = section;
    },
    closeSettings() {
      this.settingsOpen = false;
      this.settingsShortcutRecording = false;
    },
  },
});
```

- [ ] **Step 4: Update callers to use the new section-aware API without changing visible behavior yet**

```ts
// src/layout/AppShell.vue
const runtime = createAppCommandRuntime({
  // ...
  openSettings: () => ui.openSettings("general"),
  openAiSettings: () => ui.openSettings("ai"),
});

// src/components/CommandPalette.vue
const runtime = createAppCommandRuntime({
  // ...
  openSettings: () => ui.openSettings("general"),
  openAiSettings: () => ui.openSettings("ai"),
});
```

- [ ] **Step 5: Run the focused tests to verify the state changes pass**

Run: `pnpm exec vitest run tests/unit/settings-panel.spec.ts tests/unit/app-shell.spec.ts`
Expected: PASS for the new section state expectations, with existing panel assertions still failing until the layout is updated in the next task.

- [ ] **Step 6: Commit**

```bash
git add src/stores/ui.ts src/layout/AppShell.vue src/components/CommandPalette.vue tests/unit/settings-panel.spec.ts tests/unit/app-shell.spec.ts
git commit -m "feat: add settings section state"
```

### Task 2: Convert `SettingsPanel.vue` into the unified settings center shell

**Files:**
- Modify: `src/components/SettingsPanel.vue`
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Test: `tests/unit/settings-panel.spec.ts`

- [ ] **Step 1: Write the failing navigation and grouped-layout assertions**

```ts
it("renders left navigation and switches between general and shortcuts", async () => {
  const { pinia, preferences, ui } = mountPanel();
  await preferences.initialize();
  ui.openSettings("general");

  const wrapper = mount(SettingsPanel, {
    global: {
      plugins: [pinia],
    },
  });

  expect(wrapper.text()).toContain("General");
  expect(wrapper.text()).toContain("Shortcuts");
  expect(wrapper.text()).toContain("AI");
  expect(wrapper.text()).toContain("Language");

  await wrapper.get('[data-settings-section="shortcuts"]').trigger("click");

  expect(wrapper.text()).toContain("Keyboard shortcuts");
  expect(wrapper.text()).toContain("File");
  expect(wrapper.text()).not.toContain("Current language");
});
```

- [ ] **Step 2: Run the settings-panel test to verify it fails**

Run: `pnpm exec vitest run tests/unit/settings-panel.spec.ts`
Expected: FAIL because the current panel has no left navigation or section switching.

- [ ] **Step 3: Refactor the panel into a two-column settings center with section-gated content**

```vue
<!-- src/components/SettingsPanel.vue -->
<template>
  <div v-if="ui.settingsOpen" class="settings-panel" data-testid="settings-panel" @click.self="ui.closeSettings()">
    <section class="settings-panel__dialog" :aria-label="t('settings.title')" role="dialog" aria-modal="true">
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
              type="button"
              @click="resetAll"
            >
              {{ t("settings.resetAll") }}
            </button>
            <button class="settings-panel__close" type="button" :aria-label="t('settings.close')" @click="ui.closeSettings()">
              {{ t("settings.close") }}
            </button>
          </div>
        </header>

        <div v-if="ui.activeSettingsSection === 'general'" class="settings-panel__section">
          <!-- language card -->
        </div>

        <div v-else-if="ui.activeSettingsSection === 'shortcuts'" class="settings-panel__section">
          <!-- grouped shortcut cards -->
        </div>
      </div>
    </section>
  </div>
</template>
```

- [ ] **Step 4: Add localized section and card labels to the catalogs**

```ts
// src/i18n/locales/en.ts
"settings.section.general": "General",
"settings.section.general.description": "Application preferences and behavior.",
"settings.section.shortcuts": "Shortcuts",
"settings.section.shortcuts.description": "Keyboard shortcuts for app and editor commands.",
"settings.section.ai": "AI",
"settings.section.ai.description": "Provider defaults, models, and API access.",
"settings.shortcuts.title": "Keyboard shortcuts",
"settings.group.app": "App",
"settings.group.file": "File",
"settings.group.paragraph": "Paragraph",
"settings.group.format": "Format",
"settings.group.view": "View",

// src/i18n/locales/zh-CN.ts
"settings.section.general": "通用",
"settings.section.general.description": "应用偏好与基础行为。",
"settings.section.shortcuts": "快捷键",
"settings.section.shortcuts.description": "应用与编辑器命令的键盘快捷键。",
"settings.section.ai": "AI",
"settings.section.ai.description": "默认提供商、模型和 API 访问。",
"settings.shortcuts.title": "键盘快捷键",
"settings.group.app": "应用",
"settings.group.file": "文件",
"settings.group.paragraph": "段落",
"settings.group.format": "格式",
"settings.group.view": "视图",
```

- [ ] **Step 5: Run the settings-panel test to verify navigation and grouped layout pass**

Run: `pnpm exec vitest run tests/unit/settings-panel.spec.ts`
Expected: PASS for general and shortcut section rendering, while AI-specific expectations still fail until the next task.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsPanel.vue src/i18n/locales/en.ts src/i18n/locales/zh-CN.ts tests/unit/settings-panel.spec.ts
git commit -m "feat: build unified settings shell"
```

### Task 3: Fold AI provider controls into the unified settings center

**Files:**
- Modify: `src/components/SettingsPanel.vue`
- Modify: `src/stores/ai.ts`
- Delete: `src/components/AiSettingsPanel.vue`
- Test: `tests/unit/settings-panel.spec.ts`
- Test: `tests/unit/ai-settings-panel.spec.ts`

- [ ] **Step 1: Write the failing AI-section assertions in the unified panel test**

```ts
it("renders AI provider controls in the AI section and keeps save disabled until test passes", async () => {
  tauriMocks.invoke.mockResolvedValueOnce({
    ok: true,
    provider: "deepseek",
    message: "Connection succeeded",
  });

  const { pinia, ui } = mountPanel();
  const ai = useAiStore();
  ui.openSettings("ai");

  const wrapper = mount(SettingsPanel, {
    global: {
      plugins: [pinia],
    },
  });

  expect(wrapper.text()).toContain("Default Provider");
  expect(wrapper.text()).toContain("OpenAI");
  expect(wrapper.text()).toContain("DeepSeek");

  await wrapper.get('[data-testid="ai-key-input-deepseek"]').setValue("sk-test");
  expect((wrapper.get('[data-testid="ai-save-button-deepseek"]').element as HTMLButtonElement).disabled).toBe(true);

  await wrapper.get('[data-testid="ai-test-button-deepseek"]').trigger("click");
  await wrapper.vm.$nextTick();

  expect(ai.providers.deepseek.validation.message).toBe("Connection succeeded");
  expect((wrapper.get('[data-testid="ai-save-button-deepseek"]').element as HTMLButtonElement).disabled).toBe(false);
});
```

- [ ] **Step 2: Run the unified settings test to verify it fails**

Run: `pnpm exec vitest run tests/unit/settings-panel.spec.ts`
Expected: FAIL because the AI section does not exist in `SettingsPanel.vue` yet.

- [ ] **Step 3: Move AI controls into the `ai` section and make `useAiStore` delegate settings opening to the UI store**

```ts
// src/stores/ai.ts
import { useUiStore } from "@/stores/ui";

export const useAiStore = defineStore("ai", {
  state: () => ({
    activeProvider: "deepseek" as AiProviderId,
    providers: {
      openai: createProviderState("gpt-4o"),
      deepseek: createProviderState("deepseek-chat"),
    },
    // ...
  }),
  actions: {
    openSettings() {
      useUiStore().openSettings("ai");
    },
    closeSettings() {
      useUiStore().closeSettings();
    },
  },
});
```

```vue
<!-- src/components/SettingsPanel.vue -->
<div v-else class="settings-panel__section">
  <section class="settings-panel__category">
    <h3 class="settings-panel__category-title">{{ t("settings.ai.defaultProvider") }}</h3>
    <article class="settings-panel__row">
      <div class="settings-panel__meta">
        <h4 class="settings-panel__command">{{ t("settings.ai.activeProvider") }}</h4>
        <p class="settings-panel__details">{{ t("settings.ai.activeProviderDescription") }}</p>
      </div>
      <div class="settings-panel__actions">
        <select v-model="ai.activeProvider" class="settings-panel__select">
          <option value="openai">OpenAI</option>
          <option value="deepseek">DeepSeek</option>
        </select>
      </div>
    </article>
  </section>

  <section v-for="provider in providerList" :key="provider.id" class="settings-panel__category settings-panel__category--provider">
    <!-- existing provider edit/test/save/remove controls -->
  </section>
</div>
```

- [ ] **Step 4: Migrate AI settings test coverage into `settings-panel.spec.ts` and remove the obsolete panel test**

```ts
// tests/unit/settings-panel.spec.ts
const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invoke,
  isTauri: vi.fn(() => true),
}));
```

```bash
rm tests/unit/ai-settings-panel.spec.ts
```

- [ ] **Step 5: Run the unified settings-panel test to verify AI behavior still passes**

Run: `pnpm exec vitest run tests/unit/settings-panel.spec.ts`
Expected: PASS for AI provider editing, testing, save-state gating, and rendering inside the unified panel.

- [ ] **Step 6: Commit**

```bash
git add src/components/SettingsPanel.vue src/stores/ai.ts tests/unit/settings-panel.spec.ts tests/unit/ai-settings-panel.spec.ts
git commit -m "feat: merge ai settings into settings center"
```

### Task 4: Localize AI copy and finalize the settings-center presentation

**Files:**
- Modify: `src/components/SettingsPanel.vue`
- Modify: `src/i18n/locales/en.ts`
- Modify: `src/i18n/locales/zh-CN.ts`
- Test: `tests/unit/settings-panel.spec.ts`

- [ ] **Step 1: Write the failing locale-switching assertions for the AI section**

```ts
it("localizes AI section labels when switching to zh-CN", async () => {
  const { pinia, preferences, ui } = mountPanel();
  await preferences.initialize();
  ui.openSettings("ai");

  const wrapper = mount(SettingsPanel, {
    global: {
      plugins: [pinia],
    },
  });

  expect(wrapper.text()).toContain("Default Provider");

  await preferences.setLanguagePreference("zh-CN");
  await wrapper.vm.$nextTick();

  expect(wrapper.text()).toContain("默认提供商");
  expect(wrapper.text()).toContain("已配置");
});
```

- [ ] **Step 2: Run the settings-panel test to verify it fails**

Run: `pnpm exec vitest run tests/unit/settings-panel.spec.ts`
Expected: FAIL because the AI controls still contain hardcoded English copy.

- [ ] **Step 3: Add the missing AI strings and use them throughout the unified panel**

```ts
// src/i18n/locales/en.ts
"settings.ai.defaultProvider": "Default Provider",
"settings.ai.activeProvider": "Active Provider",
"settings.ai.activeProviderDescription": "Choose which AI provider to use by default.",
"settings.ai.defaultModel": "Default model: {model}",
"settings.ai.status.configured": "Configured",
"settings.ai.status.notConfigured": "Not configured",
"settings.ai.status.testing": "Testing connection...",
"settings.ai.key.placeholder": "Enter API key",
"settings.ai.action.test": "Test",
"settings.ai.action.testing": "Testing...",
"settings.ai.action.save": "Save",
"settings.ai.action.cancel": "Cancel",
"settings.ai.action.replace": "Replace",
"settings.ai.action.remove": "Remove",
"settings.ai.validation.emptyKey": "Enter an API key first.",

// src/i18n/locales/zh-CN.ts
"settings.ai.defaultProvider": "默认提供商",
"settings.ai.activeProvider": "当前提供商",
"settings.ai.activeProviderDescription": "选择默认用于 AI 改写的提供商。",
"settings.ai.defaultModel": "默认模型：{model}",
"settings.ai.status.configured": "已配置",
"settings.ai.status.notConfigured": "未配置",
"settings.ai.status.testing": "正在测试连接...",
"settings.ai.key.placeholder": "输入 API Key",
"settings.ai.action.test": "测试",
"settings.ai.action.testing": "测试中...",
"settings.ai.action.save": "保存",
"settings.ai.action.cancel": "取消",
"settings.ai.action.replace": "替换",
"settings.ai.action.remove": "移除",
"settings.ai.validation.emptyKey": "请先输入 API Key。",
```

- [ ] **Step 4: Run the settings-panel test to verify runtime locale switching works across all sections**

Run: `pnpm exec vitest run tests/unit/settings-panel.spec.ts`
Expected: PASS with localized general, shortcut, and AI copy.

- [ ] **Step 5: Commit**

```bash
git add src/components/SettingsPanel.vue src/i18n/locales/en.ts src/i18n/locales/zh-CN.ts tests/unit/settings-panel.spec.ts
git commit -m "feat: localize settings center ui"
```

### Task 5: Remove the obsolete AI overlay and align shell wiring

**Files:**
- Modify: `src/layout/AppShell.vue`
- Test: `tests/unit/app-shell.spec.ts`

- [ ] **Step 1: Write the failing shell expectations for the single settings overlay**

```ts
it("mounts only the unified settings center", () => {
  const { wrapper } = mountShell();

  expect(wrapper.findComponent({ name: "SettingsPanel" }).exists()).toBe(true);
  expect(wrapper.text()).not.toContain("AI Settings");
});
```

- [ ] **Step 2: Run the shell test to verify it fails**

Run: `pnpm exec vitest run tests/unit/app-shell.spec.ts`
Expected: FAIL because `AiSettingsPanel` is still mounted separately.

- [ ] **Step 3: Remove the extra overlay and keep both command entry points targeting the unified center**

```vue
<!-- src/layout/AppShell.vue -->
<CommandPalette />
<SettingsPanel />
<div v-if="markdownDragActive" class="app-shell__drag-overlay" data-testid="markdown-drop-overlay">
  <!-- ... -->
</div>
```

```ts
// src/layout/AppShell.vue
import SettingsPanel from "@/components/SettingsPanel.vue";
// remove import AiSettingsPanel from "@/components/AiSettingsPanel.vue";
```

- [ ] **Step 4: Run the shell test to verify the overlay wiring passes**

Run: `pnpm exec vitest run tests/unit/app-shell.spec.ts`
Expected: PASS with escape handling and unified settings mounting intact.

- [ ] **Step 5: Commit**

```bash
git add src/layout/AppShell.vue tests/unit/app-shell.spec.ts
git commit -m "refactor: remove duplicate ai settings overlay"
```

### Task 6: Update product documentation and run focused verification

**Files:**
- Modify: `docs/product/feature-list.md`
- Read: `tests/unit/settings-panel.spec.ts`
- Read: `tests/unit/app-shell.spec.ts`

- [ ] **Step 1: Update the feature list to reflect the unified settings center**

```md
## Settings

- `complete` Unified settings center groups `General`, `Shortcuts`, and `AI` in one panel with localized labels.
- `complete` AI provider configuration is available inside the main settings center instead of a separate modal.
```

- [ ] **Step 2: Run the focused verification suite**

Run: `pnpm exec vitest run tests/unit/settings-panel.spec.ts tests/unit/app-shell.spec.ts tests/unit/command-palette.spec.ts`
Expected: PASS

- [ ] **Step 3: Run the broader localization regression checks**

Run: `pnpm exec vitest run tests/unit/preferences.spec.ts tests/unit/sidebar-tabs.spec.ts tests/unit/shortcut-registry.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add docs/product/feature-list.md tests/unit/settings-panel.spec.ts tests/unit/app-shell.spec.ts tests/unit/command-palette.spec.ts
git commit -m "feat: ship unified settings center"
```
