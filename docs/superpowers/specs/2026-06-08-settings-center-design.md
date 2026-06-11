# Settings Center Design

Date: 2026-06-08
Status: approved-for-planning

## Summary

Replace the current split between `Preferences` and `AI Settings` with a single settings center. The new settings center uses a two-column layout with left-side primary navigation and right-side grouped content cards. The first release includes three top-level sections: `General`, `Shortcuts`, and `AI`.

This change is intended to fix the current information architecture problem where app language, shortcut customization, and AI provider configuration are spread across separate panels or flattened into technical groupings that do not match user intent.

## Goals

- Provide one unified settings entry point for application and AI configuration.
- Reorganize settings by user-facing content areas instead of implementation-oriented buckets.
- Preserve existing shortcut recording and AI key-management behavior while improving discoverability.
- Support current localization work by making all new section titles, descriptions, and labels localizable.
- Create a structure that can absorb future settings without redesigning the whole panel.

## Non-Goals

- Adding new setting types beyond the existing language, shortcut, and AI provider controls.
- Changing AI provider capabilities, validation rules, or persistence behavior.
- Redesigning command semantics or shortcut conflict resolution.
- Implementing notification badges or error counts in the left navigation in this phase.

## Current Problems

### Split entry points

`SettingsPanel` and `AiSettingsPanel` are separate overlays with separate open states. Users must understand the product's internal split between application preferences and AI configuration.

### Weak grouping

The current main settings panel mixes a language selector with shortcut rows and then groups commands by internal category names. This is serviceable for developers but not ideal for users scanning by task.

### Low expansion headroom

The single-column structure will become increasingly hard to navigate as more settings are added.

## Information Architecture

### Unified settings center

There will be one settings dialog component that replaces the current dual-panel structure.

Top-level navigation:

- `General`
- `Shortcuts`
- `AI`

### Section structure

#### General

Contains application-level preferences.

Initial cards:

- Language

This section is intentionally sparse in v1 and acts as the future home for additional app-level settings.

#### Shortcuts

Contains keyboard shortcut customization.

Initial card groups:

- App
- File
- Paragraph
- Format
- View
- Unavailable commands

The first release keeps the existing underlying command categories but presents them as explicit, localizable user-facing groups. Disabled commands remain visible in a separate card at the bottom and cannot be rebound.

#### AI

Contains all AI-related configuration.

Initial cards:

- Default provider
- OpenAI
- DeepSeek

Each provider card contains model display, key status, validation messaging, and key-management actions.

## Entry Points And Routing Behavior

### Open behavior

The unified settings center opens from any existing preferences-related entry point.

- The existing `Preferences` command opens the unified settings center to `General`, unless a last-active section exists.
- The existing `AI Settings` command opens the unified settings center directly to `AI`.

### Section persistence

The UI store persists the last active top-level section. When the settings center closes and reopens from a generic settings entry point, it restores the last visited section. If no stored section exists, default to `General`.

### Close behavior

Closing the settings center preserves the active section and stops shortcut recording, matching the current escape hatch behavior.

## Interaction Design

### Primary navigation

The left rail contains the three top-level sections. Switching sections updates the right content pane immediately without opening a new modal or nested route.

The left rail is a simple settings navigation, not a full application sidebar. It should remain visually restrained and compact.

### General interactions

The language setting continues to behave exactly as it does today:

- Supports `system`, `en`, and `zh-CN`
- Updates visible labels immediately
- Keeps the effective locale visible to the user

### Shortcut interactions

Existing shortcut editing behavior is preserved:

- Rebinding happens inline on the selected row
- Invalid modifier-less chords show an inline hint
- Reserved shortcuts are rejected with an inline hint
- Conflicts prompt for confirmation before replacement
- Per-command reset and reset-all remain available

The only structural change is the grouping and presentation. Recording one shortcut must not hide the rest of the section.

### AI interactions

The AI section presents one summary card for default-provider selection and one card per provider.

Per-provider behavior remains unchanged:

- Unconfigured providers start in editable mode
- Configured providers show a masked key placeholder plus replace/remove actions
- Editing a provider only affects that provider's card
- Test/save behavior stays local to the provider being edited
- Validation messages stay attached to the relevant provider card

## Visual Layout

### Dialog shell

The settings center uses a two-column modal layout:

- Left column: navigation rail
- Right column: content area with header plus stacked cards

The dialog should feel like a desktop editor preference panel rather than a marketing-style dashboard.

### Tone

Visual direction:

- clean
- tool-like
- structured
- calm

The design should prioritize stable spacing, clear hierarchy, and strong scanability over ornament.

### Cards

Each content group appears as a distinct card with:

- group title
- optional short description
- rows for settings or provider details

AI provider cards should have slightly stronger visual weight than generic setting rows so status is legible at a glance.

### Row pattern

Rows follow a consistent split layout:

- left side: label and supporting text or state
- right side: interactive control

This pattern should be shared between general settings rows, shortcut rows, and AI provider controls where practical.

## Localization Requirements

All new settings-center copy must be added to the locale catalogs for `en` and `zh-CN`, including:

- navigation labels
- section titles
- card titles
- section descriptions
- AI provider status text
- button labels that are currently hardcoded in the AI panel

The resulting unified settings center must switch languages at runtime with the rest of the UI.

## State Model Changes

### UI store

The UI store should grow from a boolean-only preferences modal model to a settings-center model with:

- open/closed state
- active settings section
- existing shortcut-recording state

The active section should be addressable by commands so external entry points can open directly to `AI`.

### AI store

The AI store no longer needs to own a separate `settingsOpen` overlay state after consolidation. It may still expose an action for opening settings, but that action should delegate into the unified UI settings-center state.

## Testing Requirements

Add or update unit tests to cover:

- unified panel rendering
- left navigation switching
- opening from the AI entry point lands on the AI section
- last active section is restored on reopen
- language section still updates locale correctly
- shortcut editing still works in the new grouped structure
- AI provider edit, test, save, replace, and remove flows still render correctly in the unified panel

Existing shortcut and AI behavior should remain covered by focused tests rather than broad snapshot assertions.

## Implementation Notes

- Prefer evolving the existing settings panel styles into a shared settings-center layout instead of maintaining two independent modal implementations.
- Remove or retire `AiSettingsPanel.vue` once its content is folded into the unified settings center.
- Keep command entry points stable even if their underlying implementation now targets a single panel.
- Reuse current stores and commands where possible; this is an information-architecture refactor, not a backend feature expansion.

## Risks

### State coupling

Merging the panels can accidentally entangle UI state between shortcut capture and AI editing. The implementation should keep those concerns isolated even if they render in one component tree.

### Localization regressions

The AI panel currently contains hardcoded English strings. Folding it into the localized settings center increases string-surface area and requires complete catalog coverage.

### Test drift

Current tests target two different panels and selectors. The refactor will require careful updates so behavior assertions remain strong rather than being weakened to match the new layout.

## Success Criteria

- Users can configure language, keyboard shortcuts, and AI providers from one settings center.
- Settings are grouped by user-facing content area, not by internal implementation boundaries.
- Existing shortcut and AI configuration behavior still works after the refactor.
- The unified settings center supports `en` and `zh-CN` at runtime.
- The structure is ready for future settings growth without another top-level reorganization.
