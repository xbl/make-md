# Internationalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add v1 internationalization to make-md for frontend UI copy, command/settings labels, and the Tauri native menu with system-locale defaulting and immediate runtime switching.

**Architecture:** Introduce a lightweight frontend i18n runtime driven by a persisted language preference and a resolved effective locale, then localize the Rust native menu through locale-aware label lookup and a runtime menu rebuild command. Keep command ids and shortcut behavior stable while migrating visible labels to message keys and locale catalogs.

**Tech Stack:** Vue 3, Pinia, TypeScript, Tauri, Rust, Vitest

**Spec:** `docs/superpowers/specs/2026-06-08-internationalization-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src/i18n/locales/en.ts` | English catalog |
| `src/i18n/locales/zh-CN.ts` | Simplified Chinese catalog |
| `src/i18n/catalog.ts` | Catalog registry, locale types, lookup helpers |
| `src/i18n/resolve-locale.ts` | Normalize system locale and compute effective locale |
| `src/i18n/runtime.ts` | Frontend translation runtime and fallback behavior |
| `src/lib/system-locale.ts` | Frontend bridge for reading system locale / syncing menu locale |
| `src/stores/preferences.ts` | Persist `languagePreference`, load `systemLocale`, expose `effectiveLocale` |
| `src/composables/useI18n.ts` | Small adapter for Vue components |
| `src/components/SettingsPanel.vue` | Add language selector and localize visible settings copy |
| `src/components/SidebarTabs.vue` | Localize recent/files sidebar labels and actions |
| `src/components/CommandPalette.vue` | Localize command palette UI wrapper copy |
| `src/lib/shortcuts/registry.ts` | Move command labels to message keys/localized lookup |
| `src/lib/commands/manifest.json` or manifest builder path | Keep generated command manifest aligned with localized labels |
| `src/layout/AppShell.vue` | Initialize preferences/i18n on startup and trigger menu sync |
| `src-tauri/src/i18n.rs` | Rust locale normalization and menu label tables |
| `src-tauri/src/menu.rs` | Build native menu from locale-aware labels and rebuild on demand |
| `src-tauri/src/main.rs` | Register new i18n commands |
| `tests/unit/resolve-locale.spec.ts` | Frontend locale resolution coverage |
| `tests/unit/preferences.spec.ts` | Preference/system/effective locale behavior |
| `tests/unit/settings-panel.spec.ts` | Language selector and localized settings UI |
| `tests/unit/sidebar-tabs.spec.ts` | Localized sidebar recent/files labels |
| `tests/unit/command-palette.spec.ts` | Localized command palette wrapper text and command labels |
| `tests/unit/shortcut-registry.spec.ts` | Command catalog label lookup remains stable by id |
| `src-tauri/src/i18n.rs` unit tests | Rust locale normalization and menu label lookup |

### Task 1: Add locale infrastructure and resolution in the frontend

**Files:**
- Create: `src/i18n/locales/en.ts`
- Create: `src/i18n/locales/zh-CN.ts`
- Create: `src/i18n/catalog.ts`
- Create: `src/i18n/resolve-locale.ts`
- Create: `src/i18n/runtime.ts`
- Test: `tests/unit/resolve-locale.spec.ts`

- [ ] **Step 1: Write the failing locale-resolution test**

```ts
import { describe, expect, it } from "vitest";
import { normalizeSystemLocale, resolveEffectiveLocale } from "@/i18n/resolve-locale";

describe("resolve locale", () => {
  it("normalizes supported and fallback locales", () => {
    expect(normalizeSystemLocale("zh-Hans-CN")).toBe("zh-CN");
    expect(normalizeSystemLocale("zh-Hans-SG")).toBe("zh-CN");
    expect(normalizeSystemLocale("en-GB")).toBe("en");
    expect(normalizeSystemLocale("fr-FR")).toBe("en");
  });

  it("prefers the explicit preference over the system locale", () => {
    expect(resolveEffectiveLocale("zh-CN", "en-US")).toBe("zh-CN");
    expect(resolveEffectiveLocale("en", "zh-CN")).toBe("en");
    expect(resolveEffectiveLocale("system", "zh-Hans-CN")).toBe("zh-CN");
  });
});
```

- [ ] **Step 2: Run the locale-resolution test to verify it fails**

Run: `pnpm exec vitest run tests/unit/resolve-locale.spec.ts`
Expected: FAIL because the i18n modules do not exist yet.

- [ ] **Step 3: Write the minimal locale catalogs and resolver**

```ts
// src/i18n/catalog.ts
export const SUPPORTED_LOCALES = ["en", "zh-CN"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LanguagePreference = SupportedLocale | "system";

// src/i18n/resolve-locale.ts
import type { LanguagePreference, SupportedLocale } from "@/i18n/catalog";

export function normalizeSystemLocale(locale: string | null | undefined): SupportedLocale {
  const value = (locale ?? "").toLowerCase();
  if (value.startsWith("zh")) {
    return "zh-CN";
  }
  if (value.startsWith("en")) {
    return "en";
  }
  return "en";
}

export function resolveEffectiveLocale(
  preference: LanguagePreference,
  systemLocale: string | null | undefined,
): SupportedLocale {
  if (preference !== "system") {
    return preference;
  }
  return normalizeSystemLocale(systemLocale);
}
```

- [ ] **Step 4: Add the frontend translation runtime**

```ts
// src/i18n/runtime.ts
import { computed, ref } from "vue";
import { catalogs, DEFAULT_LOCALE, type MessageKey, type SupportedLocale } from "@/i18n/catalog";

const activeLocale = ref<SupportedLocale>(DEFAULT_LOCALE);

export function setActiveLocale(locale: SupportedLocale) {
  activeLocale.value = locale;
}

export function useTranslationRuntime() {
  const locale = computed(() => activeLocale.value);

  function t(key: MessageKey) {
    return catalogs[activeLocale.value][key] ?? catalogs[DEFAULT_LOCALE][key] ?? key;
  }

  return { locale, t };
}
```

- [ ] **Step 5: Run the locale-resolution test to verify it passes**

Run: `pnpm exec vitest run tests/unit/resolve-locale.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/i18n/locales/en.ts src/i18n/locales/zh-CN.ts src/i18n/catalog.ts src/i18n/resolve-locale.ts src/i18n/runtime.ts tests/unit/resolve-locale.spec.ts
git commit -m "feat: add frontend locale runtime"
```

### Task 2: Add a preferences store for language preference and system locale

**Files:**
- Create: `src/lib/system-locale.ts`
- Create: `src/stores/preferences.ts`
- Test: `tests/unit/preferences.spec.ts`
- Read for reference: `src/stores/shortcuts.ts`

- [ ] **Step 1: Write the failing preferences-store test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { usePreferencesStore } from "@/stores/preferences";

vi.mock("@/lib/system-locale", () => ({
  loadSystemLocale: vi.fn(async () => "zh-Hans-CN"),
  syncMenuLocale: vi.fn(async () => {}),
}));

describe("preferences store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("loads system locale and resolves the effective locale", async () => {
    const store = usePreferencesStore();
    await store.initialize();
    expect(store.languagePreference).toBe("system");
    expect(store.systemLocale).toBe("zh-Hans-CN");
    expect(store.effectiveLocale).toBe("zh-CN");
  });

  it("persists an explicit language preference", async () => {
    const store = usePreferencesStore();
    await store.initialize();
    await store.setLanguagePreference("en");
    expect(store.effectiveLocale).toBe("en");
    expect(localStorage.getItem("make-md:language")).toBe("en");
  });
});
```

- [ ] **Step 2: Run the preferences-store test to verify it fails**

Run: `pnpm exec vitest run tests/unit/preferences.spec.ts`
Expected: FAIL because the store and system-locale bridge do not exist.

- [ ] **Step 3: Add the Tauri bridge wrappers**

```ts
// src/lib/system-locale.ts
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { SupportedLocale } from "@/i18n/catalog";

export async function loadSystemLocale() {
  if (!isTauri()) {
    return navigator.language;
  }
  return invoke<string>("get_system_locale");
}

export async function syncMenuLocale(locale: SupportedLocale) {
  if (!isTauri()) {
    return;
  }
  await invoke("sync_menu_locale", { locale });
}
```

- [ ] **Step 4: Add the preferences store**

```ts
// src/stores/preferences.ts
import { defineStore } from "pinia";
import { resolveEffectiveLocale } from "@/i18n/resolve-locale";
import type { LanguagePreference } from "@/i18n/catalog";
import { loadSystemLocale, syncMenuLocale } from "@/lib/system-locale";

const STORAGE_KEY = "make-md:language";

export const usePreferencesStore = defineStore("preferences", {
  state: () => ({
    languagePreference: (localStorage.getItem(STORAGE_KEY) as LanguagePreference | null) ?? "system",
    systemLocale: "en-US",
  }),
  getters: {
    effectiveLocale(state) {
      return resolveEffectiveLocale(state.languagePreference, state.systemLocale);
    },
  },
  actions: {
    async initialize() {
      this.systemLocale = await loadSystemLocale();
      await syncMenuLocale(this.effectiveLocale);
    },
    async setLanguagePreference(preference: LanguagePreference) {
      this.languagePreference = preference;
      localStorage.setItem(STORAGE_KEY, preference);
      await syncMenuLocale(this.effectiveLocale);
    },
  },
});
```

- [ ] **Step 5: Run the preferences-store test to verify it passes**

Run: `pnpm exec vitest run tests/unit/preferences.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/system-locale.ts src/stores/preferences.ts tests/unit/preferences.spec.ts
git commit -m "feat: add locale preferences store"
```

### Task 3: Localize settings and sidebar UI, including the language selector

**Files:**
- Modify: `src/components/SettingsPanel.vue`
- Modify: `src/components/SidebarTabs.vue`
- Create or modify: `src/composables/useI18n.ts`
- Test: `tests/unit/settings-panel.spec.ts`
- Test: `tests/unit/sidebar-tabs.spec.ts`

- [ ] **Step 1: Extend the failing settings-panel test with language UI assertions**

```ts
it("shows a language selector and updates labels when the locale changes", async () => {
  const { pinia, ui } = mountPanel();
  const preferences = usePreferencesStore();
  await preferences.initialize();
  ui.openSettings();
  const wrapper = mount(SettingsPanel, { global: { plugins: [pinia] } });

  expect(wrapper.text()).toContain("Preferences");
  expect(wrapper.get("[data-testid='language-select']").exists()).toBe(true);

  await preferences.setLanguagePreference("zh-CN");
  await wrapper.vm.$nextTick();

  expect(wrapper.text()).toContain("偏好设置");
  expect(wrapper.text()).toContain("跟随系统");
});
```

- [ ] **Step 2: Extend the failing sidebar-tabs test with locale assertions**

```ts
it("localizes recent view labels", async () => {
  const documents = useDocumentsStore();
  documents.recentFiles = [];
  const preferences = usePreferencesStore();
  await preferences.initialize();
  await preferences.setLanguagePreference("zh-CN");

  const wrapper = mountRecentTabs();
  expect(wrapper.text()).toContain("最近文件");
  expect(wrapper.text()).toContain("没有最近文件");
});
```

- [ ] **Step 3: Run the settings and sidebar tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/settings-panel.spec.ts tests/unit/sidebar-tabs.spec.ts`
Expected: FAIL because the UI is still hardcoded in English and no language selector exists.

- [ ] **Step 4: Add the Vue i18n adapter**

```ts
// src/composables/useI18n.ts
import { storeToRefs } from "pinia";
import { usePreferencesStore } from "@/stores/preferences";
import { setActiveLocale, useTranslationRuntime } from "@/i18n/runtime";

export function useI18n() {
  const preferences = usePreferencesStore();
  setActiveLocale(preferences.effectiveLocale);
  const runtime = useTranslationRuntime();
  const { effectiveLocale } = storeToRefs(preferences);
  return { ...runtime, effectiveLocale };
}
```

- [ ] **Step 5: Localize `SettingsPanel.vue` and add the language selector**

```vue
<select
  data-testid="language-select"
  :value="preferences.languagePreference"
  @change="onLanguageChange"
>
  <option value="system">{{ t("settings.language.system") }}</option>
  <option value="en">{{ t("settings.language.en") }}</option>
  <option value="zh-CN">{{ t("settings.language.zhCN") }}</option>
</select>
```

```ts
import { usePreferencesStore } from "@/stores/preferences";
import { useI18n } from "@/composables/useI18n";

const preferences = usePreferencesStore();
const { t } = useI18n();

async function onLanguageChange(event: Event) {
  const value = (event.target as HTMLSelectElement).value as "system" | "en" | "zh-CN";
  await preferences.setLanguagePreference(value);
}
```

- [ ] **Step 6: Localize `SidebarTabs.vue`**

```vue
<div class="panel__title">{{ folderWorkspace.hasFolder ? folderTitle : t("sidebar.recent.title") }}</div>
...
<button ...>{{ t("common.clear") }}</button>
<button ...>{{ t("common.new") }}</button>
<button ...>{{ t("common.open") }}</button>
...
<p v-if="documents.recentFiles.length === 0" class="panel__empty">
  {{ t("sidebar.recent.empty") }}
</p>
```

- [ ] **Step 7: Run the settings and sidebar tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/settings-panel.spec.ts tests/unit/sidebar-tabs.spec.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/composables/useI18n.ts src/components/SettingsPanel.vue src/components/SidebarTabs.vue tests/unit/settings-panel.spec.ts tests/unit/sidebar-tabs.spec.ts
git commit -m "feat: localize settings and sidebar ui"
```

### Task 4: Localize command labels and command-palette-visible copy

**Files:**
- Modify: `src/lib/shortcuts/registry.ts`
- Modify: `src/components/CommandPalette.vue`
- Modify: `src/lib/app-commands.ts`
- Test: `tests/unit/shortcut-registry.spec.ts`
- Test: `tests/unit/command-palette.spec.ts`

- [ ] **Step 1: Add a failing shortcut-registry test for translated command labels**

```ts
import { describe, expect, it } from "vitest";
import { getCommandCatalog } from "@/lib/shortcuts/registry";

describe("shortcut registry localization", () => {
  it("resolves labels by locale without changing ids", () => {
    const zh = getCommandCatalog("zh-CN");
    const open = zh.find((command) => command.id === "file.open");
    expect(open?.label).toBe("打开文件");
  });
});
```

- [ ] **Step 2: Run the registry and command-palette tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/shortcut-registry.spec.ts tests/unit/command-palette.spec.ts`
Expected: FAIL because command labels are still embedded directly in the catalog.

- [ ] **Step 3: Refactor the registry to derive labels from message keys**

```ts
type CommandSeed = Omit<CommandDef, "label"> & { labelKey: MessageKey };

const COMMAND_SEEDS: CommandSeed[] = [
  { id: "file.open", labelKey: "command.file.open", category: "file", scope: "app", defaultChord: "Mod-o", enabled: true },
];

export function getCommandCatalog(locale: SupportedLocale): CommandDef[] {
  return COMMAND_SEEDS.map(({ labelKey, ...seed }) => ({
    ...seed,
    label: translate(locale, labelKey),
  }));
}
```

- [ ] **Step 4: Update command-palette consumers to use localized catalog labels**

```ts
const preferences = usePreferencesStore();
const catalog = computed(() => getCommandCatalog(preferences.effectiveLocale));
```

- [ ] **Step 5: Run the registry and command-palette tests to verify they pass**

Run: `pnpm exec vitest run tests/unit/shortcut-registry.spec.ts tests/unit/command-palette.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/shortcuts/registry.ts src/components/CommandPalette.vue src/lib/app-commands.ts tests/unit/shortcut-registry.spec.ts tests/unit/command-palette.spec.ts
git commit -m "feat: localize command labels"
```

### Task 5: Add Rust locale support and native menu rebuilding

**Files:**
- Create: `src-tauri/src/i18n.rs`
- Modify: `src-tauri/src/menu.rs`
- Modify: `src-tauri/src/main.rs`
- Test: `src-tauri/src/i18n.rs`

- [ ] **Step 1: Add the failing Rust tests for locale normalization and menu labels**

```rust
#[cfg(test)]
mod tests {
    use super::{menu_label, normalize_locale};

    #[test]
    fn normalizes_system_locales() {
        assert_eq!(normalize_locale("zh-Hans-CN"), "zh-CN");
        assert_eq!(normalize_locale("en-GB"), "en");
        assert_eq!(normalize_locale("fr-FR"), "en");
    }

    #[test]
    fn returns_translated_menu_labels() {
        assert_eq!(menu_label("zh-CN", "menu.file"), "文件");
        assert_eq!(menu_label("en", "menu.file.open"), "Open File");
    }
}
```

- [ ] **Step 2: Run the Rust tests to verify they fail**

Run: `cargo test i18n --manifest-path src-tauri/Cargo.toml`
Expected: FAIL because the Rust i18n module does not exist.

- [ ] **Step 3: Implement Rust locale lookup and commands**

```rust
// src-tauri/src/i18n.rs
pub fn normalize_locale(locale: &str) -> &'static str {
    let lower = locale.to_ascii_lowercase();
    if lower.starts_with("zh") {
        "zh-CN"
    } else if lower.starts_with("en") {
        "en"
    } else {
        "en"
    }
}

#[tauri::command]
pub fn get_system_locale() -> String {
    std::env::var("LANG").unwrap_or_else(|_| "en-US".to_string())
}
```

- [ ] **Step 4: Refactor `menu.rs` to use locale-based labels and rebuild on command**

```rust
#[tauri::command]
pub fn sync_menu_locale<R: Runtime>(app: AppHandle<R>, locale: String) -> Result<(), String> {
    let menu = build_menu_for_locale(&app, &locale).map_err(|err| err.to_string())?;
    app.set_menu(menu).map_err(|err| err.to_string())
}
```

- [ ] **Step 5: Register the new commands in `main.rs`**

```rust
mod i18n;

...
i18n::get_system_locale,
i18n::sync_menu_locale,
```

- [ ] **Step 6: Run the Rust tests to verify they pass**

Run: `cargo test i18n --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/i18n.rs src-tauri/src/menu.rs src-tauri/src/main.rs
git commit -m "feat: localize native menu"
```

### Task 6: Wire app startup, add end-to-end unit coverage, and verify regressions

**Files:**
- Modify: `src/layout/AppShell.vue`
- Modify: `tests/unit/app-shell.spec.ts`
- Modify: `tests/unit/menu-bridge.spec.ts`
- Read for reference: `src/components/SettingsPanel.vue`, `src/stores/preferences.ts`

- [ ] **Step 1: Add a failing app-shell test for locale initialization**

```ts
it("initializes preferences and syncs locale on startup", async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const preferences = usePreferencesStore();
  const initSpy = vi.spyOn(preferences, "initialize");

  mount(AppShell, { global: { plugins: [pinia] } });
  await nextTick();

  expect(initSpy).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the app-shell and related tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/app-shell.spec.ts tests/unit/menu-bridge.spec.ts`
Expected: FAIL because startup does not initialize locale preferences yet.

- [ ] **Step 3: Wire locale initialization into app startup**

```ts
import { usePreferencesStore } from "@/stores/preferences";

const preferences = usePreferencesStore();

onMounted(() => {
  void preferences.initialize();
});
```

- [ ] **Step 4: Run the focused frontend test suite**

Run: `pnpm exec vitest run tests/unit/resolve-locale.spec.ts tests/unit/preferences.spec.ts tests/unit/settings-panel.spec.ts tests/unit/sidebar-tabs.spec.ts tests/unit/shortcut-registry.spec.ts tests/unit/command-palette.spec.ts tests/unit/app-shell.spec.ts`
Expected: PASS

- [ ] **Step 5: Run the Rust locale/menu tests**

Run: `cargo test i18n --manifest-path src-tauri/Cargo.toml`
Expected: PASS

- [ ] **Step 6: Review the final diff**

Run: `git diff -- src/i18n src/lib/system-locale.ts src/stores/preferences.ts src/components/SettingsPanel.vue src/components/SidebarTabs.vue src/components/CommandPalette.vue src/lib/shortcuts/registry.ts src/lib/app-commands.ts src/layout/AppShell.vue src-tauri/src/i18n.rs src-tauri/src/menu.rs src-tauri/src/main.rs tests/unit/resolve-locale.spec.ts tests/unit/preferences.spec.ts tests/unit/settings-panel.spec.ts tests/unit/sidebar-tabs.spec.ts tests/unit/shortcut-registry.spec.ts tests/unit/command-palette.spec.ts tests/unit/app-shell.spec.ts`
Expected: only i18n-related infrastructure, UI localization, native menu localization, and test changes.

- [ ] **Step 7: Commit**

```bash
git add src/i18n src/lib/system-locale.ts src/stores/preferences.ts src/components/SettingsPanel.vue src/components/SidebarTabs.vue src/components/CommandPalette.vue src/lib/shortcuts/registry.ts src/lib/app-commands.ts src/layout/AppShell.vue src-tauri/src/i18n.rs src-tauri/src/menu.rs src-tauri/src/main.rs tests/unit/resolve-locale.spec.ts tests/unit/preferences.spec.ts tests/unit/settings-panel.spec.ts tests/unit/sidebar-tabs.spec.ts tests/unit/shortcut-registry.spec.ts tests/unit/command-palette.spec.ts tests/unit/app-shell.spec.ts
git commit -m "feat: add internationalization foundation"
```

## Self-review

- Spec coverage:
  - frontend UI localization: Tasks 1, 2, 3, 6
  - command/settings labels: Tasks 3 and 4
  - native menu localization and immediate rebuild: Task 5 and Task 6
  - system-locale default + manual override: Tasks 1 and 2
  - extensible locale catalogs: Task 1
- Placeholder scan: no `TODO`/`TBD` placeholders remain.
- Type consistency:
  - locale values are consistently `system | en | zh-CN`
  - effective locale is consistently resolved through the preferences store
  - Rust sync command is consistently named `sync_menu_locale`
