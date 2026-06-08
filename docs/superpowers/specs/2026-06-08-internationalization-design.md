# Internationalization Design

**Date:** 2026-06-08  
**Goal:** Add v1 internationalization to make-md for frontend UI copy, command/settings labels, and the Tauri native menu, with system-locale defaulting and immediate runtime switching.

## Scope

### In scope

- Frontend Vue UI copy
- Command labels and shortcut/settings copy
- Tauri native top-level menu labels and menu-item labels
- Language preference in Settings
- System locale detection with supported-locale fallback
- Immediate runtime language switching without app restart

### Out of scope

- System-native file dialog localization
- README and external docs localization
- Test names and developer-facing fixture text
- AI prompt localization
- Full Rust-side user error localization outside the menu layer

## Product requirements

v1 supports:

- `en`
- `zh-CN`

The architecture must allow more locales to be added later without changing feature code.

Default behavior:

- On first launch, the app follows the system locale.
- If the system locale is unsupported, the app falls back to `en`.
- Users can override the language manually in Settings.

Switch behavior:

- Frontend UI updates immediately after language change.
- Native Tauri menu updates immediately after language change by rebuilding the menu.

## Current state

The codebase currently hardcodes user-facing strings in multiple layers:

- Vue components such as `SidebarTabs.vue` and `SettingsPanel.vue`
- Command/shortcut catalog and settings-derived UI
- Rust native menu construction in `src-tauri/src/menu.rs`

There is no i18n runtime, no locale preference model, and no shared message-key discipline. The result is that adding multilingual support now would otherwise require repeated edits across unrelated files and would drift over time.

## Design overview

Use a message-key-based localization model with separate runtime consumers for frontend UI and Rust native menu rendering.

The system is split into four layers:

1. Locale catalogs keyed by stable message ids
2. Frontend i18n runtime with reactive locale resolution and `t()`
3. Persistent language preference plus system-locale fallback resolution
4. Rust menu localization layer that rebuilds the menu on locale change

This keeps command ids stable and non-localized while allowing all visible labels to be translated.

## Locale model

Three distinct values are used:

### `languagePreference`

Persisted user choice:

- `system`
- `en`
- `zh-CN`

This is the user-selected preference, not the final display locale.

### `systemLocale`

Runtime locale reported by the platform, such as:

- `en-US`
- `en-GB`
- `zh-CN`
- `zh-Hans-CN`

### `effectiveLocale`

Resolved locale used by the app UI and native menu.

Resolution rules:

1. If `languagePreference` is not `system`, use it directly.
2. If `languagePreference` is `system`, normalize the platform locale to a supported locale.
3. If normalization does not match a supported locale, fall back to `en`.

Examples:

- `zh-CN` -> `zh-CN`
- `zh-Hans-CN` -> `zh-CN`
- `zh-Hans-SG` -> `zh-CN`
- `en-US` -> `en`
- `fr-FR` -> `en`

## Frontend architecture

Add a small dedicated i18n module rather than introducing a large framework in v1.

### Proposed structure

- `src/i18n/locales/en.ts`
- `src/i18n/locales/zh-CN.ts`
- `src/i18n/keys.ts` or `schema.ts`
- `src/i18n/resolve-locale.ts`
- `src/i18n/runtime.ts`
- `src/composables/useI18n.ts`

### Frontend responsibilities

- Load locale catalogs
- Resolve `effectiveLocale`
- Expose reactive translation lookup via `t(key, params?)`
- Expose current locale metadata to Settings
- Persist `languagePreference`
- Trigger native menu sync when `effectiveLocale` changes

### Catalog rules

- Message keys are stable and semantic, for example:
  - `settings.title`
  - `settings.language.label`
  - `recent.empty`
  - `menu.file.open`
- Components must not contain user-facing hardcoded copy after migration.
- Missing keys should fall back to `en`.
- In development, missing keys should log a warning.

## Rust architecture

Add a focused Rust i18n layer for locale-aware menu rendering.

### Proposed structure

- `src-tauri/src/i18n.rs`
- updated `src-tauri/src/menu.rs`

### Rust responsibilities

- Return system locale to the frontend
- Accept an `effectiveLocale` value from the frontend
- Resolve localized menu labels from Rust-side catalogs
- Rebuild the native menu immediately when locale changes

Rust does not own the user preference state. It only consumes the already-resolved locale for menu rendering.

## Menu localization model

Keep command ids unchanged:

- `file.open`
- `view.commandPalette`
- `app.preferences`

Translate only labels:

- top-level groups such as `File`, `Edit`, `View`
- menu items such as `Open File`, `Preferences…`, `Export PDF`

This preserves all existing command routing, keyboard shortcuts, and event handling.

The menu builder should stop embedding raw English strings in the command table. Instead it should derive labels from locale catalogs using stable keys.

## Settings UX

Add a language control to Settings with these visible options:

- `Follow System`
- `English`
- `简体中文`

Recommended display behavior:

- Show the currently effective language when `Follow System` is selected.
- If system locale falls back, the UI should still remain stable without extra warnings in v1.

No restart prompt is needed in v1 because both frontend and native menu are expected to refresh immediately.

## Data flow

### App startup

1. Frontend loads persisted `languagePreference`.
2. Frontend invokes Rust to read `systemLocale`.
3. Frontend resolves `effectiveLocale`.
4. Frontend initializes i18n runtime with `effectiveLocale`.
5. Frontend invokes Rust to sync/rebuild the native menu for `effectiveLocale`.

### User changes language

1. User changes language in Settings.
2. Frontend updates and persists `languagePreference`.
3. Frontend recalculates `effectiveLocale`.
4. Frontend UI rerenders with the new locale.
5. Frontend invokes Rust menu sync with the new `effectiveLocale`.
6. Rust rebuilds the native menu immediately.

## Error handling

- Unsupported system locales resolve silently to `en`.
- Missing frontend translation keys fall back to `en` and log warnings in development.
- Rust menu translation misses should fall back to `en` rather than failing menu creation.
- If native menu rebuild fails, the app should log the error and keep the current frontend locale active. Frontend switching must not be blocked by menu refresh failure.

## Testing strategy

### Frontend unit tests

- locale resolution:
  - `system + zh-Hans-CN -> zh-CN`
  - `system + en-GB -> en`
  - `system + fr-FR -> en`
  - manual override beats system locale
- settings rendering:
  - language selector shows expected options
  - switching preference updates visible labels immediately
- common UI surfaces:
  - Sidebar/Recent empty state and actions localize correctly
  - Settings section titles and button labels localize correctly
- missing key behavior:
  - falls back to `en`
  - emits development warning

### Rust tests

- locale normalization behavior for supported/fallback cases
- menu label lookup for `en`
- menu label lookup for `zh-CN`
- menu build uses localized top-level and item labels

### Integration tests

- startup with system locale uses expected `effectiveLocale`
- changing language from Settings updates both frontend text and native menu sync path
- command ids and accelerators remain unchanged across locales

## Migration plan

### Phase 1: Infrastructure

- Add locale catalogs
- Add locale preference model
- Add system locale query
- Add locale resolver and runtime

### Phase 2: Frontend UI migration

- Migrate high-visibility UI first:
  - Settings
  - Sidebar / Recent
  - command-related labels
  - common empty states and action buttons

### Phase 3: Native menu migration

- Refactor `src-tauri/src/menu.rs` to use localized labels
- Add runtime menu rebuild command

### Phase 4: Guardrails

- Add tests
- Add a codebase rule that new user-facing strings must come from message keys

## Non-goals for v1

To keep the first implementation contained, v1 intentionally does not include:

- localized README/docs
- localized system-native open/save dialogs
- localized AI prompt content
- broad Rust error-message localization across all commands

## Acceptance criteria

1. The app supports `en` and `zh-CN`.
2. The default language follows the system locale and falls back to `en` when unsupported.
3. Users can switch language manually in Settings.
4. Frontend UI updates immediately after switching language.
5. Tauri native menu updates immediately after switching language.
6. Command ids, shortcuts, and behavior remain stable across locales.
7. Adding a new locale requires catalog additions, not scattered feature-code edits.
