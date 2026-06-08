# AI Editing Design

**Date:** 2026-06-07  
**Status:** Approved  
**Goal:** Add AI-powered writing assistance to make-md — multi-provider LLM integration (OpenAI, DeepSeek), AGENTS.md + Skill configuration, selection-based rewrite with context, and full-document rewrite.

---

## Requirements Summary

| Dimension | Decision |
|-----------|----------|
| Interaction | Preset quick actions + custom natural-language instructions |
| Agent/Skill config | Project-level priority, merged with global (`~/.cursor/`) |
| Selection context | Selected text + current section (until next same-level heading) |
| Full-doc context | Entire document Markdown; truncate with warning if over token budget |
| Result application | Inline diff preview at edit range; Accept / Reject |
| API configuration | In-app settings page; keys stored in system keychain (Tauri) |
| Skill invocation | Auto-match by document path + description keywords; inject into system prompt |
| Response display | Streaming output with cancel support |

---

## Architecture

Hybrid approach (recommended and approved): Rust handles secrets and HTTP streaming; TypeScript handles prompt orchestration, Skill matching, context extraction, and editor diff logic.

```
┌─────────────────────────────────────────────────────────┐
│  UI (Vue)                                               │
│  AiEditToolbar · AiSettingsPanel · diff decorations     │
├─────────────────────────────────────────────────────────┤
│  Orchestration (src/lib/ai/)                            │
│  orchestrator · context · skill-matcher · presets       │
├─────────────────────────────────────────────────────────┤
│  Config (src/lib/ai/config/)                            │
│  agents-loader · skills-loader · settings store         │
├─────────────────────────────────────────────────────────┤
│  Platform (src-tauri/src/ai/)                         │
│  keychain · stream-proxy · providers (openai/deepseek)  │
└─────────────────────────────────────────────────────────┘
```

### Module Responsibilities

| Module | Location | Responsibility |
|--------|----------|----------------|
| `keychain` | Rust | API key read/write via system keychain |
| `stream` | Rust | OpenAI-compatible streaming requests; push chunks via Tauri Events |
| `providers` | Rust | Per-provider base URL and header differences |
| `agents-loader` | TS | Load and merge `AGENTS.md` (project > global) |
| `skills-loader` | TS | Scan Skill directories; parse frontmatter |
| `skill-matcher` | TS | Score Skills by path globs + description keywords; pick top-3 |
| `context` | TS | Extract selection + section or full-document Markdown from ProseMirror |
| `orchestrator` | TS | Assemble messages → invoke Rust stream → manage cancellation |
| `ai-edit-plugin` | TS | ProseMirror diff decorations; accept/reject transactions |
| `useAiStore` | Pinia | Provider config, generation state, current preview |

### Config Sources and Priority

```
Project AGENTS.md         → overrides/extends global rules
~/.cursor/AGENTS.md       → global fallback

Project skills/           → highest priority
Project .cursor/skills/   → second
~/.cursor/skills/         → global fallback
```

Merge rules: same-named Skill at project level overrides global; `AGENTS.md` contents are concatenated (project first).

### New File Structure

```
src-tauri/src/ai/
  mod.rs
  keychain.rs
  stream.rs
  providers.rs

src/lib/ai/
  orchestrator.ts
  context.ts
  skill-matcher.ts
  presets.ts
  stream-client.ts
  config/
    agents-loader.ts
    skills-loader.ts
    types.ts

src/editor/ai-edit/
  plugin.ts
  apply.ts

src/components/
  AiEditToolbar.vue
  AiSettingsPanel.vue

src/stores/ai.ts
```

---

## Components and Interaction

### Triggers

**Selection rewrite**
- `AiEditToolbar` floats below non-empty selection
- Context menu → "AI Rewrite"
- Command palette → "AI: Rewrite Selection"
- Shortcut: ⌘⇧A (selection mode when selection exists)

**Full-document rewrite**
- Command palette → "AI: Rewrite Document"
- Toolbar entry when no selection
- When selection exists, toolbar offers "Rewrite full document" toggle (default: selection mode)

### AiEditToolbar Layout

```
┌──────────────────────────────────────────────────┐
│  [Polish] [Translate EN] [Translate ZH]          │
│  [Expand] [Condense]  │  [Custom...]  [✕]        │
└──────────────────────────────────────────────────┘
```

"Custom..." expands a single-line input + Send. While generating, show Stop button (AbortController).

Full-document mode: toolbar title becomes "Rewrite document"; presets use document-level labels.

### Built-in Presets (v1)

| ID | Label | System instruction summary |
|----|-------|---------------------------|
| `polish` | Polish | Improve prose; preserve meaning and Markdown structure |
| `translate-en` | Translate to English | Translate to English; preserve formatting |
| `translate-zh` | Translate to Chinese | Translate to Chinese; preserve formatting |
| `expand` | Expand | Enrich content without changing core points |
| `condense` | Condense | Shorten while keeping key information |

Presets defined in `presets.ts`; matched Skills appended to system prompt.

### Interaction Flow

1. User picks preset or enters custom instruction
2. Orchestrator loads `AGENTS.md` + auto-matched Skills
3. Context extracted (selection + section, or full document)
4. `invoke("ai_stream", ...)` → Rust proxy → provider API
5. Chunks arrive via Tauri Events; `ai-edit-plugin` updates diff decorations
6. User Accept (apply replacement) or Reject (restore snapshot)
7. Esc cancels generation or rejects preview

### Diff Preview

**Selection mode**
- Original text: strikethrough + reduced opacity
- New text: green highlight, streamed incrementally
- Floating actions: Accept / Reject at selection

**Full-document mode**
- Same `ai-edit-plugin`, range spans entire document
- Line-level diff (not character-level) for performance
- Fixed bar at editor top: "Previewing full-document rewrite — [Accept all] [Reject]"
- Accept: single `parseMarkdown` + replace document content
- Reject: restore pre-generation snapshot

Line diff: compare AI Markdown vs current doc using `diff` library; decorate only changed lines.

### AiSettingsPanel

Opened via command palette "AI: Settings" or app menu.

- Provider list: OpenAI, DeepSeek (v1)
- Per provider: API Key, default model, optional Base URL
- Active provider radio selection
- Key masked as `••••••••` with Change button
- Test connection button

Non-sensitive settings persisted as JSON; keys in keychain only.

### Skill Auto-matching

1. Scan loaded Skills; read frontmatter `description`
2. Score:
   - Document path matches Skill `globs` → +10
   - Description keyword overlap with first 500 chars of document → +1 per word
3. Take top-3; inject content at end of system prompt
4. No match: use `AGENTS.md` + preset instruction only

### Skill File Format (Cursor-compatible)

```markdown
---
name: technical-writing
description: Technical documentation style guide for API docs
globs: docs/**,*.md
---

# Technical Writing Rules
...
```

`globs` optional; without globs, matching relies on description keywords.

---

## Data Flow, Prompts, and Error Handling

### Prompt Assembly

```
system:
  [Merged AGENTS.md content]
  [Matched Skill contents, up to 3]
  [Preset instruction or general rewrite rules]
  ---
  You are a Markdown editing assistant. Output only the modified Markdown text, no explanation.
  Preserve formatting (headings, lists, code blocks, links, etc.).
  Selection mode: output only the replacement text for the selection.
  Full-document mode: output the complete document.

user:
  [Context Markdown]
  ---
  [Selection mode]
  Modify the following selected text:
  > {selection}

  Instruction: {preset_label or user_instruction}

  [Full-document mode]
  Modify the entire document per this instruction:
  Instruction: {preset_label or user_instruction}

  ---
  {full_document_markdown}
```

### Context Extraction (`context.ts`)

**Selection mode**
1. Read `from` / `to` from `state.selection`; serialize selection text
2. Walk up to nearest heading node for section start
3. Walk down to next same-or-higher-level heading for section end
4. Serialize `[sectionStart, sectionEnd)` as section context

**Full-document mode**
1. `serializeMarkdown(state.doc)` for full document
2. Estimate tokens (char count / 4)
3. If over budget (~80% of model context window): truncate with warning (keep first 70% + last 10%, insert `...\n[content truncated]\n...`); set `truncated: true`

### Rust Streaming Proxy

```rust
// invoke args
struct AiStreamRequest {
    request_id: String,
    provider: String,   // "openai" | "deepseek"
    model: String,
    messages: Vec<Message>,
}

// Event: "ai://chunk/{request_id}"  → { "delta": "..." }
// Event: "ai://done/{request_id}"   → { "usage": { ... } }
// Event: "ai://error/{request_id}"  → { "message": "...", "code": "..." }
```

Frontend `stream-client.ts`:
- `invoke("ai_stream", ...)` starts request
- `listen("ai://chunk/...")` accumulates deltas
- `AbortController` → `invoke("ai_cancel", { request_id })`
- `unlisten` on completion

### Apply Transactions

**Selection accept:** parse AI result as inline Markdown; `tr.replaceWith(from, to, parsedNodes)`

**Full-document accept:** `parseMarkdown(aiResult)` → `tr.replaceWith(0, doc.content.size, newDoc.content)`

**Reject:** restore pre-generation snapshot (original Markdown string or EditorState).

Editor read-only during generation (`editable: () => false`).

### Error Handling

| Scenario | User-facing | Technical |
|----------|-------------|-----------|
| API Key not configured | Prompt to open AI Settings | Pre-check in orchestrator |
| Auth failure (401) | Toast: invalid API Key | `ai://error` code=auth |
| Rate limit (429) | Toast: try again later | No auto-retry |
| Network timeout | Toast + Retry button | 30s timeout; 1 retry |
| User cancel | Keep partial diff preview; user may accept partial | AbortController |
| Document truncated | Warning bar: result may be incomplete | `truncated` flag |
| Non-Markdown AI output | Insert as plain text; code-block fallback | Parse failure fallback |
| Concurrent request | Block: generation already in progress | `isGenerating` lock in store |

### Key Storage

```
Keychain service: "make-md"
Account:          "ai-key:{provider}"

App data (non-sensitive):
{
  "activeProvider": "deepseek",
  "providers": {
    "openai":   { "model": "gpt-4o", "baseUrl": null },
    "deepseek": { "model": "deepseek-chat", "baseUrl": null }
  }
}
```

### AGENTS.md / Skill Load Timing

- Scan and cache when folder workspace opens
- Refresh on file watcher events for `AGENTS.md` or Skill changes
- Without open folder: global config only + walk up to 3 parent dirs from current file for `AGENTS.md`

---

## Testing and Phased Delivery

### Unit Tests (Vitest, no Tauri)

| Module | Focus |
|--------|-------|
| `context.ts` | Section boundaries; full-doc truncation |
| `skill-matcher.ts` | Glob match; keyword scoring; top-N |
| `agents-loader.ts` | Project/global merge priority |
| `skills-loader.ts` | Frontmatter parse; directory scan |
| `presets.ts` | Preset instruction strings |
| `orchestrator.ts` | Prompt assembly (mock stream-client) |
| `ai-edit/plugin.ts` | Diff decorations; accept/reject transactions |

### Rust Tests

| Module | Focus |
|--------|-------|
| `providers.rs` | URL and header construction |
| `stream.rs` | SSE parsing (mock HTTP) |
| `keychain.rs` | Read/write round-trip (mock in CI) |

### E2E (Playwright + mocked AI stream)

- Settings: configure key → test connection
- Selection rewrite: select → preset → preview → accept
- Full-document rewrite: command palette → preview bar → reject restores doc

### Phased Delivery

| Phase | Scope | ~Duration |
|-------|-------|-----------|
| AI-1 | Rust keychain + stream-proxy + providers; TS stream-client + ai store + settings panel | 3 days |
| AI-2 | Selection rewrite: context, orchestrator, presets, ai-edit plugin, toolbar | 3 days |
| AI-3 | AGENTS.md + Skill loaders + auto-matcher | 2 days |
| AI-4 | Full-document rewrite: line diff, command palette, truncation warning | 2 days |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘⇧A | Open AI rewrite (selection or full document) |
| Esc | Reject preview / stop generation |

### New Dependencies

```json
// package.json
"diff": "^7.0.0"
```

```toml
# src-tauri/Cargo.toml
reqwest = { features = ["stream", "json"] }
keyring = "..."
```

---

## Out of Scope (v1)

- Side-panel multi-turn chat
- Local models (Ollama)
- Manual Skill picker UI
- Custom preset editor UI
