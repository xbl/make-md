# Product Feature List

Last updated: 2026-06-07

Status legend:
- `complete`: shipped and usable in the product
- `partial`: shipped in part, but still has notable gaps
- `not_started`: planned or listed in menus/specs, but not implemented yet

## Editor Core

| Feature | Status | Notes |
|---|---|---|
| Typora-style live Markdown editing | `complete` | ProseMirror-based editor with live rich rendering instead of source/code split view. |
| Block input shortcuts | `complete` | Supports headings, bullet lists, blockquotes, code fences, task lists, and horizontal rules. |
| Inline mark typing and paste parsing | `complete` | Supports bold, italic, inline code, strike, and link patterns while typing and pasting. |
| Inline formatting shortcuts | `complete` | Bold, italic, inline code, strike, link, and clear formatting are wired through editor commands. |
| Heading conversion commands | `complete` | Heading 1-6 and paragraph conversion are implemented. |
| Blockquote command | `partial` | Markdown parsing/rendering exists, but menu/shortcut command execution is not fully wired yet. |
| Ordered list command | `partial` | Document model and parser support exist, but menu/shortcut command execution is not fully wired yet. |
| Unordered list command | `partial` | Document model and parser support exist, but menu/shortcut command execution is not fully wired yet. |
| Increase/decrease heading level | `partial` | Command ids and menu entries exist, but runtime behavior still needs completion. |
| Code fence language selection | `complete` | Entering code fences can prompt for language; existing fences can update language. |
| Fenced code syntax highlight | `partial` | Overlay/highlight plumbing exists and visibility bug was fixed, but behavior is still being aligned and verified. |
| Inline code heuristic coloring | `complete` | Inline code token decoration exists in the editor. |
| Mermaid blocks | `complete` | Mermaid block rendering is supported. |
| Tables in document model/parser | `complete` | Table parsing/rendering exists. |
| Insert table command | `not_started` | `paragraph.table` remains disabled in the shared command manifest. |
| Math blocks / formulas | `not_started` | Explicitly called out as next-phase work. |
| Footnotes | `not_started` | Explicitly called out as next-phase work. |
| Front matter editing | `not_started` | Explicitly called out as next-phase work. |
| TOC support | `not_started` | Explicitly called out as next-phase work. |

## Search And Replace

| Feature | Status | Notes |
|---|---|---|
| Find bar | `complete` | In-document find UI and state plugin exist. |
| Replace bar | `complete` | Replace one and replace all are implemented. |
| Find next / previous commands | `complete` | Editor command events now drive next/previous navigation. |
| Case-sensitive search | `complete` | Supported in the find/replace UI. |
| Whole-word search | `complete` | Supported in the find/replace UI. |

## Workspace And File Management

| Feature | Status | Notes |
|---|---|---|
| Open single Markdown file | `complete` | File workflow is implemented. |
| Open folder workspace | `complete` | Folder tree browsing is implemented. |
| File tree navigation | `complete` | Sidebar file tree exists. |
| File create / rename / delete / move | `complete` | Phase 2 workspace file operations shipped. |
| File watching / refresh | `complete` | Workspace watch layer exists in Tauri. |
| Multi-tab editing | `complete` | Tab strip and multiple document sessions exist. |
| Recent files | `complete` | Rust-backed recent file handling exists. |
| Unsaved change prompts | `complete` | Prompt flow exists for dirty documents. |

## Outline And Navigation

| Feature | Status | Notes |
|---|---|---|
| Document outline panel | `complete` | Outline sidebar tab is shipped. |
| Click heading to navigate | `complete` | Outline items navigate to headings. |
| Sidebar section switching | `complete` | Files and Outline tabs exist. |

## Images And Assets

| Feature | Status | Notes |
|---|---|---|
| Paste image into document | `complete` | Images are stored into local assets alongside the document. |
| Drop image into document | `complete` | Drag/drop asset flow exists. |
| Relative asset path handling | `complete` | Image asset helpers and plugin exist. |
| Insert image dialog / command | `not_started` | `format.image` remains disabled in the shared command manifest. |

## Menus, Shortcuts, And Commands

| Feature | Status | Notes |
|---|---|---|
| Native application menu | `complete` | Tauri native menu is installed with File/Edit/Paragraph/Format/View/Export sections. |
| Command palette | `complete` | Command palette UI and registry exist. |
| Shared command catalog | `complete` | Manifest/registry-backed command ids are used across surfaces. |
| Keyboard shortcut customization | `complete` | Preferences panel supports recording and resetting shortcuts. |
| Native menu to runtime bridge | `complete` | Menu events are forwarded into frontend command execution. |
| Menu coverage for common format commands | `complete` | Bold, italic, inline code, strike, link, clear, headings, find-next/previous are wired. |
| Menu coverage for paragraph/list transforms | `partial` | Quote, lists, and heading level adjustments are listed but not fully wired. |
| Underline command | `not_started` | Listed but disabled. |

## View And Productivity

| Feature | Status | Notes |
|---|---|---|
| Focus mode | `complete` | Focus mode is shipped. |
| Sidebar toggle | `complete` | Sidebar show/hide is shipped. |
| Command palette shortcut | `complete` | Shortcut and handler exist. |
| Files / Outline focus commands | `partial` | View command ids exist; behavior should be validated end to end. |
| Theme toggle | `complete` | README documents light/dark theme support. |

## Export

| Feature | Status | Notes |
|---|---|---|
| Export HTML | `complete` | Standalone HTML export exists. |
| Export PDF | `complete` | PDF export exists, with macOS browser dependency noted in README. |
| Syntax-highlighted HTML export | `partial` | Design/spec expects hljs export alignment; current implementation should continue to be verified against editor behavior. |

## Reliability

| Feature | Status | Notes |
|---|---|---|
| Autosave | `complete` | Autosave module exists. |
| Crash recovery snapshots | `complete` | Rust-backed recovery exists. |
| Session recovery flow | `complete` | Recovery support is present in both frontend and Tauri layers. |

## Preferences And Settings

| Feature | Status | Notes |
|---|---|---|
| Preferences dialog | `complete` | Settings panel is shipped. |
| Shortcut recording UI | `complete` | Users can record and reset bindings. |
| Settings integrated with native menu | `complete` | Preferences command is reachable from the native menu. |
| Internationalization | `not_started` | Discussed as a next area, but no i18n layer is present yet. |

## Verification Notes

- This document reflects the current product state inferred from `README.md`, shipped UI/components, command manifest, and active implementation plans.
- When a feature changes state, update the row in the relevant module instead of appending ad hoc notes elsewhere.
