---
version: "alpha"
name: "make-md"
description: >
  A calm, paper-inspired reading/writing environment. Warm neutral tones on
  light, cool desaturated neutrals on dark. Typography prioritizes CJK–Latin
  harmony with IBM Plex and PingFang SC. Accent is a quiet blue that signals
  interactivity without shouting.
colors:
  # ── Backgrounds ──
  bg-paper:        "#fafaf8"
  bg-sidebar:      "#f3f2ee"
  bg-elevated:     "#ffffff"
  bg-subtle:       "#eeede8"
  bg-hover:        "rgba(28, 28, 26, 0.04)"
  bg-active:       "rgba(44, 82, 130, 0.08)"

  # ── Text ──
  text-primary:    "#1c1c1a"
  text-secondary:  "#5c5c57"
  text-muted:      "#94948c"
  text-faint:      "#b8b8b0"

  # ── Borders ──
  border:          "#e4e2dc"
  border-strong:   "#d0cec6"

  # ── Accent / Brand ──
  accent:          "#2c5282"
  accent-soft:     "rgba(44, 82, 130, 0.10)"
  accent-hover:    "rgba(44, 82, 130, 0.14)"
  link:            "#2563a8"

  # ── Editor chrome ──
  editor-text:     "#242422"
  code-bg:         "#f0efea"
  code-text:       "#3d3d38"
  ic-kw:           "#0550ae"
  ic-str:          "#0a6634"
  ic-num:          "#953800"
  ic-op:           "#57606a"
  quote-border:    "#c4bdb0"
  quote-text:      "#5a5a54"
  find-match:      "rgba(255, 212, 120, 0.55)"
  find-match-active: "rgba(255, 166, 77, 0.82)"

  # ── Semantic (static; re-assigned per theme via CSS) ──
  toolbar-bg:         "color-mix(in srgb, {colors.bg-elevated} 94%, transparent)"
  toolbar-bg-hover:   "rgba(28, 28, 26, 0.06)"
  toolbar-text:       "{colors.text-secondary}"
  toolbar-text-hover: "{colors.text-primary}"
  toolbar-border:     "{colors.border}"
  toolbar-shadow:     "0 4px 16px rgba(28, 28, 26, 0.10)"

  # ── Dark-theme overrides (not a separate palette; listed here for agent awareness) ──
  # bg-paper:        "#1a1a18"
  # bg-sidebar:      "#222220"
  # bg-elevated:     "#2a2a28"
  # bg-subtle:       "#333330"
  # bg-hover:        "rgba(255, 255, 255, 0.05)"
  # bg-active:       "rgba(120, 160, 210, 0.12)"
  # text-primary:    "#ecece8"
  # text-secondary:  "#a8a8a0"
  # text-muted:      "#787870"
  # text-faint:      "#585850"
  # border:          "rgba(255, 255, 255, 0.08)"
  # border-strong:   "rgba(255, 255, 255, 0.14)"
  # accent:          "#7eb0e8"
  # accent-soft:     "rgba(126, 176, 232, 0.12)"
  # accent-hover:    "rgba(126, 176, 232, 0.18)"
  # link:            "#8ec0ff"
  # toolbar-bg-hover: "rgba(255, 255, 255, 0.08)"
  # toolbar-shadow:  "0 4px 16px rgba(0, 0, 0, 0.30)"

typography:
  font-ui:
    fontFamily: >
      "IBM Plex Sans", "PingFang SC", "Noto Sans SC", "Hiragino Sans GB", sans-serif
  font-body:
    fontFamily: >
      "PingFang SC", "Noto Sans SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif
  font-heading:
    fontFamily: >
      "IBM Plex Sans", "PingFang SC", "Noto Sans SC", "Hiragino Sans GB", sans-serif
  font-editor:
    fontFamily: "{typography.font-body.fontFamily}"
  font-mono:
    fontFamily: >
      "IBM Plex Mono", "SF Mono", ui-monospace, Menlo, monospace
  text-ui:
    fontSize: 12px
  text-sm:
    fontSize: 13px
  text-editor:
    fontSize: 15px
  leading-editor:
    lineHeight: 1.78

rounded:
  sm: 6px
  md: 8px
  lg: 10px

spacing:
  # No explicit spacing scale tokens exist yet.
  # Spacing is applied ad-hoc via gap/padding/margin in component CSS.
  # Toolbar canonical values (documented here for agent reference):
  #   toolbar-padding: 6px 8px
  #   toolbar-gap:     4px
  #   toolbar-btn-padding: 4px 8px

components:
  toolbar:
    backgroundColor: "{colors.toolbar-bg}"
    textColor: "{colors.toolbar-text}"
    rounded: "{rounded.sm}"
    border:
      width: 1px
      style: solid
      color: "{colors.toolbar-border}"
    shadow: "{colors.toolbar-shadow}"
    backdrop-filter: blur(10px)

  toolbar__btn:
    backgroundColor: transparent
    textColor: "{colors.toolbar-text}"
    rounded: 4px
    padding: 4px 8px
    typography:
      fontSize: 12px
      fontWeight: 500

  toolbar__btn_hover:
    backgroundColor: "{colors.toolbar-bg-hover}"
    textColor: "{colors.toolbar-text-hover}"

  toolbar__size:
    textColor: "{colors.toolbar-text}"
    opacity: 0.7
    typography:
      fontSize: 11px
---

## Overview

make-md is a Markdown editing environment that feels closer to a reading app
than a code editor. The visual language draws from print typography and
plain-paper aesthetics: warm off-white backgrounds in light mode, cool
near-black surfaces in dark mode. Every color, radius, and shadow is encoded
as a CSS custom property on `:root` so the entire UI responds to a single
`data-theme` attribute flip.

**Theme mechanism:** `document.documentElement.dataset.theme` is set to
`"light"` or `"dark"` by `src/stores/ui.ts`. All tokens are defined in
`src/styles/app.css` under `:root` (light) and `:root[data-theme="dark"]`
(dark). There is no Tailwind — the token system is plain CSS custom properties.

## Colors

The palette is organized into five functional layers: backgrounds, text,
borders, accent, and editor chrome. Each layer has a progression from
prominent to subtle.

**Backgrounds** descend from the paper/sidebar/elevated/subtle hierarchy.
`--bg-paper` is the page surface, `--bg-sidebar` is the navigation rail,
`--bg-elevated` is for floating surfaces (dialogs, toolbars, menus), and
`--bg-subtle` is for low-contrast inset regions. `--bg-hover` and
`--bg-active` are transparent overlays applied on top of any background.

**Text** follows a four-step scale: primary for body/prose, secondary for
labels and metadata, muted for placeholder and disabled states, faint for
decorative elements.

**Accent** is a restrained blue (`#2c5282` light / `#7eb0e8` dark) used
sparingly for focus rings, selection highlights, and primary action
indicators. Links use a slightly brighter blue (`#2563a8` / `#8ec0ff`).

**Editor chrome** colors cover code syntax highlighting, blockquote
decorations, and find-in-page matches. They are intentionally lower
contrast than the UI chrome so the reader's attention stays on the content.

**Dark mode** inverts the warmth: light mode's warm paper tones become cool
charcoal, and accent colors shift to lighter, cooler blues to maintain
perceived brightness against dark backgrounds.

## Typography

The system uses a CJK–Latin font stack. UI surfaces prefer IBM Plex Sans
(a geometric grotesk); body text prefers PingFang SC (a humanist sans
optimized for Chinese). The two families are mixed via the `--font-ui` and
`--font-body` tokens, with `--font-editor` aliasing `--font-body`.

Monospace is IBM Plex Mono with SF Mono and system-ui fallbacks.

**Scale:** The UI uses 12–13px for chrome, 15px for editor body text.
Line height in the editor is 1.78 — generous to improve readability of
mixed CJK/Latin lines.

## Layout & Spacing

The project does not currently define a formal spacing scale. Layout is
achieved through flexbox/grid with ad-hoc `gap`, `padding`, and `margin`
values in component CSS. The toolbar specification defines canonical
values (padding `6px 8px`, gap `4px`, button padding `4px 8px`) that
should be treated as the emerging spacing micro-scale for floating UI.

## Elevation & Depth

Three shadow tokens encode elevation:

| Token | Use |
|---|---|
| `--shadow-sm` | Subtle lift (cards, hover indicators) |
| `--shadow-md` | Floating panels, dropdowns |
| `--shadow-lg` | Modals, dialogs |

The unified toolbar uses its own `--toolbar-shadow` token, sitting between
`sm` and `md` in perceived elevation. The toolbar also applies
`backdrop-filter: blur(10px)` for a frosted-glass effect against the
editor content behind it.

## Shapes

Three border-radius tokens define the curvature scale: `--radius-sm` (6px)
for compact controls, `--radius-md` (8px) for cards and panels, `--radius-lg`
(10px) for modals. The toolbar uses `--radius-sm` (6px) for its container
and 4px for individual buttons — slightly tighter than the global scale to
keep the toolbar compact.

## Components

### Toolbar (`.editor-toolbar`)

A floating action bar positioned absolutely above the editor viewport.
Used by both the AI edit toolbar (Vue component) and the image toolbar
(ProseMirror plugin). Both instances share the same BEM classes and CSS
custom properties.

- **Container:** `border-radius: 6px`, `padding: 6px 8px`, `gap: 4px`,
  `z-index: 30`, `backdrop-filter: blur(10px)`, centered via
  `transform: translateX(-50%)`
- **Button (`__btn`):** Transparent background, 12px/500 text, 4px border-radius,
  4px 8px padding. Hover reveals a subtle background fill.
- **Size label (`__size`):** 11px text at 0.7 opacity, right-margin 8px.
  Image toolbar only.

Mutual exclusion: the AI toolbar only appears for `TextSelection` (ProseMirror).
When an image `NodeSelection` is active, only the image toolbar is shown.
See `src/editor/EditorView.vue:updateSelectionToolbar()`.

## Do's and Don'ts

- **Do** use `var(--token)` for every color — never hardcode a hex/rgba value.
- **Do** use BEM naming for new component classes that are part of the shared
  design language (e.g., `.editor-toolbar__btn`).
- **Do** add a CSS custom property when a value appears in 3+ places.
- **Don't** add Tailwind or another utility framework — the project uses plain
  CSS with custom properties.
- **Don't** define new CSS variables outside `src/styles/app.css` unless they
  are truly component-local and have no theme dependency.
- **Don't** use `z-index` values ad-hoc. Reference the canonical layers:
  table controls (existing), editor toolbars (30), context menu (existing).
