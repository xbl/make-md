# App Icon Design

**Date:** 2026-06-07  
**Status:** Approved  
**Scope:** New application icon for `make-md`, including master artwork direction, export targets, and replacement of Tauri app icon assets

---

## Summary

`make-md` needs a project-specific application icon that reads as a Markdown writing tool rather than a generic utility. The selected direction is a restrained, document-first icon: a dark rounded-square app tile containing a white rounded document page whose internal layout forms a subtle `M`.

The icon should feel native on macOS, stay legible at small sizes, and avoid decorative effects that would push it toward note-app cliches or generic startup branding.

---

## User Decisions

| Topic | Choice |
|-------|--------|
| Primary metaphor | Document-first |
| Visual tone | Minimal and restrained |
| Palette | Black and white only |
| Brand cue | Integrate `M` into the document structure |
| Chosen concept | `B` direction: document page with editorial `M` |
| Document silhouette | Soft rounded rectangle |

---

## Design Goal

The icon should communicate, in order:

1. This is a desktop document editor
2. It has a Markdown / writing-oriented identity
3. The brand cue is the letter `M`, discovered as part of the layout rather than as a loud monogram

This ordering matters. If the icon reads as a generic lettermark before it reads as a document tool, the concept has failed.

---

## Final Concept

### Structure

- Outer tile: dark rounded square sized for desktop app icon usage
- Inner shape: centered white document page with soft corners
- Internal mark: a black `M` constructed from layout strokes inside the page
- Supporting cue: a short horizontal baseline beneath the `M`, suggesting text composition or paragraph structure

### Visual behavior

- The document page remains the dominant shape
- The `M` should feel embedded in the page layout, not pasted on top as a logo
- The baseline should be short and quiet, used only to strengthen the “editorial page” reading

### Rejected traits

The icon must not use:

- accent colors
- gradients inside the page glyph
- paper textures
- realistic page shadows
- glossy, glassy, metallic, or skeuomorphic finishes
- pen, pencil, cursor, or markdown punctuation as primary symbols

---

## Geometry Guidance

### Outer tile

- Rounded square, visually balanced for Dock and launcher contexts
- Dark fill with very light depth only if needed for separation
- Corner radius should be modern and calm, not overly playful

### Document page

- Centered with generous padding from the tile edge
- White fill
- Soft rounded corners rather than sharp document edges
- No folded corner in the final chosen direction

### `M` construction

- Built from medium-weight black strokes
- Wide enough to stay readable at 32 px and below
- Stroke rhythm should resemble typeset structure, not handwritten lettering
- The `M` should sit comfortably in the upper-middle of the page

### Baseline

- Short horizontal rule beneath the `M`
- Aligned to reinforce editorial structure
- Must remain secondary to the page and the `M`

---

## Small-Size Requirements

The icon must remain readable at:

- 512 px master size
- 128 px application icon size
- 64 px utility views
- 32 px and 16 px small launcher contexts

At reduced sizes:

- the document page silhouette must remain clear
- the `M` must still read as intentional structure rather than noise
- the baseline may simplify slightly if necessary, but should not disappear in the primary exported sizes unless legibility demands it

---

## Asset Plan

### Source of truth

Create one clean master artwork for the icon, sized for raster export.

Recommended master:

- `src-tauri/icons/icon-master.png` at 1024x1024 or larger

If a vector source is created during the process, it should also be kept in-project for future edits. The raster master remains the minimum required deliverable.

### Export targets

Replace the current assets generated under [src-tauri/icons](/Users/blxie/Documents/make-md/src-tauri/icons), including:

- primary PNG app icons
- macOS `.icns`
- Windows `.ico`
- platform square logo variants
- iOS icon set
- Android launcher assets

The exported set should remain compatible with the existing Tauri packaging flow.

---

## Implementation Approach

### Artwork generation

Two acceptable paths:

1. Generate a clean bitmap master aligned to the spec, then derive platform assets from it
2. Generate or refine a vector-like master, then rasterize to required sizes before packaging

Recommendation: create a high-resolution bitmap master first, because the current project assets are already raster-based and Tauri icon generation can proceed from a strong square master.

### Asset replacement

After the master is approved:

1. Back up or preserve the current icon source if needed
2. Export the new square master to the required base PNG sizes
3. Regenerate Tauri icon variants to replace existing platform assets
4. Verify the desktop app references the new icon without further config changes

---

## Verification

Before considering the work complete:

- visually inspect the master artwork at large size
- inspect exports at 128 px, 64 px, and 32 px
- confirm the icon still reads as document-first in a dark app-tile context
- verify generated files exist under [src-tauri/icons](/Users/blxie/Documents/make-md/src-tauri/icons)
- launch the app in development mode and confirm the updated icon appears in the app shell / bundle output as applicable on the current platform

---

## Out of Scope

- full brand system
- splash screen redesign
- toolbar or in-app logo usage
- marketing illustrations
- alternate color themes for the icon

---

## Success Criteria

- `make-md` has a distinct app icon aligned with the chosen concept
- the icon reads first as a document editor, then as an `M` brand cue
- the result stays monochrome and restrained
- exported assets replace the current Tauri icon set without breaking packaging
- the icon remains legible at small sizes typical of desktop launcher usage
