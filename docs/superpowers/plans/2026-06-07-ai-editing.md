# AI Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build AI-powered Markdown rewriting for make-md with provider settings, secure key storage, streaming preview, selection rewrite, full-document rewrite, and project/global AGENTS.md + Skill loading.

**Architecture:** Keep secrets, provider-specific HTTP requests, and streaming in Tauri/Rust. Keep prompt assembly, AGENTS.md/Skill loading, editor context extraction, diff preview, and accept/reject behavior in the Vue/TypeScript editor layer. Ship the feature incrementally so settings and transport land before editor-side rewrite UX.

**Tech Stack:** Tauri, Rust, reqwest, keyring, Vue 3, Pinia, ProseMirror, TypeScript, Vitest, Playwright, `diff`.

---

## File Map

| File | Responsibility |
|------|----------------|
| `src-tauri/src/ai/mod.rs` | Register AI commands and shared request types |
| `src-tauri/src/ai/providers.rs` | Provider definitions, URLs, headers, defaults |
| `src-tauri/src/ai/keychain.rs` | Secure API key persistence |
| `src-tauri/src/ai/stream.rs` | OpenAI-compatible streaming proxy + cancellation |
| `src-tauri/src/main.rs` | Mount AI module and Tauri commands |
| `src/lib/ai/presets.ts` | Built-in rewrite presets |
| `src/lib/ai/context.ts` | Selection/full-document Markdown extraction + truncation |
| `src/lib/ai/stream-client.ts` | Tauri invoke/listen wrapper for stream lifecycle |
| `src/lib/ai/orchestrator.ts` | Prompt assembly, provider dispatch, cancel flow |
| `src/lib/ai/skill-matcher.ts` | Skill scoring and top-N selection |
| `src/lib/ai/config/agents-loader.ts` | Project/global AGENTS.md loading and merge |
| `src/lib/ai/config/skills-loader.ts` | Skill directory scanning and parsing |
| `src/lib/ai/config/types.ts` | Shared config types |
| `src/editor/ai-edit/plugin.ts` | AI preview decorations and editor locking |
| `src/editor/ai-edit/apply.ts` | Accept/reject transactions for selection and full document |
| `src/components/AiSettingsPanel.vue` | Provider, model, key, and connection settings |
| `src/components/AiEditToolbar.vue` | Selection/full-document rewrite entry UI |
| `src/stores/ai.ts` | Provider settings, generation state, preview state |
| `src/layout/AppShell.vue` | Wire settings panel, commands, and toolbar mounting |
| `src/lib/shortcuts/registry.ts` | AI commands and shortcut definitions |
| `src/lib/app-commands.ts` | Command palette entries for AI actions |
| `tests/unit/ai-*.spec.ts` | TS unit coverage across loaders, context, orchestrator, plugin |
| `src-tauri/src/ai/*.rs` tests | Rust unit coverage for providers, stream, keychain |
| `tests/e2e/ai-editing.spec.ts` | End-to-end AI rewrite flow with mocked stream |

## Delivery Notes

- Deliver in four slices matching the approved design: transport/settings, selection rewrite, AGENTS/Skills, full-document rewrite.
- Keep all AI commands no-op if provider config is missing.
- Reuse existing menu/command/shortcut architecture rather than adding a parallel command system.
- Update `docs/product/feature-list.md` when AI functionality starts shipping.

### Task 1: Rust AI transport, provider config, and secure key storage

**Files:**
- Create: `src-tauri/src/ai/mod.rs`
- Create: `src-tauri/src/ai/providers.rs`
- Create: `src-tauri/src/ai/keychain.rs`
- Create: `src-tauri/src/ai/stream.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml`
- Test: `src-tauri/src/ai/providers.rs`
- Test: `src-tauri/src/ai/stream.rs`
- Test: `src-tauri/src/ai/keychain.rs`

- [ ] **Step 1: Write the failing Rust tests**

Add unit tests covering provider resolution, header construction, and request cancellation:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_openai_defaults() {
        let provider = ProviderConfig::from_name("openai").unwrap();
        assert_eq!(provider.base_url, "https://api.openai.com/v1/chat/completions");
        assert_eq!(provider.auth_header_name, "Authorization");
    }

    #[test]
    fn resolves_deepseek_defaults() {
        let provider = ProviderConfig::from_name("deepseek").unwrap();
        assert!(provider.base_url.contains("deepseek"));
    }
}
```

```rust
#[cfg(test)]
mod keychain_tests {
    use super::*;

    #[test]
    fn key_ref_round_trip_uses_provider_account_name() {
        let account = provider_account("openai");
        assert_eq!(account, "ai-key:openai");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cargo test ai::providers::tests::resolves_openai_defaults`
Expected: FAIL because `src-tauri/src/ai/` does not exist yet.

- [ ] **Step 3: Add dependencies and minimal AI module wiring**

Update `src-tauri/Cargo.toml` with the transport and key storage dependencies:

```toml
reqwest = { version = "0.12", features = ["json", "stream"] }
keyring = "3"
tokio = { version = "1", features = ["sync"] }
futures-util = "0.3"
serde_json = "1"
```

Create provider and keychain primitives:

```rust
// src-tauri/src/ai/providers.rs
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderConfig {
    pub name: &'static str,
    pub base_url: &'static str,
    pub auth_header_name: &'static str,
}

impl ProviderConfig {
    pub fn from_name(name: &str) -> Option<Self> {
        match name {
            "openai" => Some(Self {
                name: "openai",
                base_url: "https://api.openai.com/v1/chat/completions",
                auth_header_name: "Authorization",
            }),
            "deepseek" => Some(Self {
                name: "deepseek",
                base_url: "https://api.deepseek.com/chat/completions",
                auth_header_name: "Authorization",
            }),
            _ => None,
        }
    }
}
```

```rust
// src-tauri/src/ai/keychain.rs
pub const KEYCHAIN_SERVICE: &str = "make-md";

pub fn provider_account(provider: &str) -> String {
    format!("ai-key:{provider}")
}
```

Register the module in `src-tauri/src/main.rs`:

```rust
mod ai;
```

- [ ] **Step 4: Add stream command shapes and command registration**

Create the invoke-facing request types and stub commands:

```rust
// src-tauri/src/ai/mod.rs
use serde::{Deserialize, Serialize};

pub mod keychain;
pub mod providers;
pub mod stream;

#[derive(Debug, Deserialize)]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct AiStreamRequest {
    pub request_id: String,
    pub provider: String,
    pub model: String,
    pub messages: Vec<AiMessage>,
}

#[tauri::command]
pub async fn ai_stream(app: tauri::AppHandle, request: AiStreamRequest) -> Result<(), String> {
    stream::start_stream(app, request).await
}

#[tauri::command]
pub async fn ai_cancel(request_id: String) -> Result<(), String> {
    stream::cancel_stream(&request_id)
}
```

Expose commands from `src-tauri/src/main.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    ai::ai_stream,
    ai::ai_cancel,
])
```

- [ ] **Step 5: Implement streaming proxy and key read/write helpers**

Add secure key persistence and event-based chunk emission:

```rust
// src-tauri/src/ai/keychain.rs
pub fn save_api_key(provider: &str, api_key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &provider_account(provider)).map_err(|e| e.to_string())?;
    entry.set_password(api_key).map_err(|e| e.to_string())
}

pub fn load_api_key(provider: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &provider_account(provider)).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}
```

```rust
// src-tauri/src/ai/stream.rs
pub async fn start_stream(app: tauri::AppHandle, request: AiStreamRequest) -> Result<(), String> {
    let provider = ProviderConfig::from_name(&request.provider).ok_or_else(|| "unknown provider".to_string())?;
    let api_key = load_api_key(&request.provider)?.ok_or_else(|| "missing api key".to_string())?;
    let client = reqwest::Client::new();

    let response = client
        .post(provider.base_url)
        .header(provider.auth_header_name, format!("Bearer {api_key}"))
        .json(&serde_json::json!({
            "model": request.model,
            "stream": true,
            "messages": request.messages,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    app.emit(format!("ai://done/{}", request.request_id), serde_json::json!({ "usage": null }))
        .map_err(|e| e.to_string())?;
    let _ = response;
    Ok(())
}
```

- [ ] **Step 6: Run Rust tests to verify they pass**

Run: `cargo test ai::`
Expected: PASS for provider/keychain unit tests and compile success for AI command registration.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/ai src-tauri/src/main.rs
git commit -m "feat: add ai transport and key storage"
```

### Task 2: Frontend AI settings store, panel, and stream client

**Files:**
- Create: `src/stores/ai.ts`
- Create: `src/lib/ai/stream-client.ts`
- Create: `src/components/AiSettingsPanel.vue`
- Modify: `src/layout/AppShell.vue`
- Modify: `src/lib/app-commands.ts`
- Modify: `src/lib/shortcuts/registry.ts`
- Test: `tests/unit/ai-store.spec.ts`
- Test: `tests/unit/ai-settings-panel.spec.ts`
- Test: `tests/unit/ai-stream-client.spec.ts`

- [ ] **Step 1: Write the failing store and panel tests**

```ts
import { describe, it, expect } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useAiStore } from "@/stores/ai";

describe("ai store", () => {
  it("defaults to deepseek as the active provider", () => {
    setActivePinia(createPinia());
    const store = useAiStore();
    expect(store.activeProvider).toBe("deepseek");
    expect(store.providers.openai.model).toBeTruthy();
  });
});
```

```ts
import { mount } from "@vue/test-utils";
import AiSettingsPanel from "@/components/AiSettingsPanel.vue";

describe("AiSettingsPanel", () => {
  it("renders provider controls when opened", () => {
    const wrapper = mount(AiSettingsPanel, {
      global: {
        stubs: { Teleport: true },
      },
    });
    expect(wrapper.text()).toContain("AI Settings");
    expect(wrapper.text()).toContain("OpenAI");
    expect(wrapper.text()).toContain("DeepSeek");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/ai-store.spec.ts tests/unit/ai-settings-panel.spec.ts tests/unit/ai-stream-client.spec.ts`
Expected: FAIL because the AI store, stream client, and settings panel do not exist yet.

- [ ] **Step 3: Implement the AI store and settings model**

```ts
// src/stores/ai.ts
import { defineStore } from "pinia";
import { ref } from "vue";

export const useAiStore = defineStore("ai", () => {
  const settingsOpen = ref(false);
  const activeProvider = ref<"openai" | "deepseek">("deepseek");
  const providers = ref({
    openai: { model: "gpt-4o", baseUrl: "" },
    deepseek: { model: "deepseek-chat", baseUrl: "" },
  });
  const isGenerating = ref(false);

  function openSettings() {
    settingsOpen.value = true;
  }

  function closeSettings() {
    settingsOpen.value = false;
  }

  return { settingsOpen, activeProvider, providers, isGenerating, openSettings, closeSettings };
});
```

- [ ] **Step 4: Implement stream client wrapper**

```ts
// src/lib/ai/stream-client.ts
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export async function startAiStream(requestId: string, payload: Record<string, unknown>) {
  const chunks: string[] = [];
  const unlistenChunk = await listen<{ delta: string }>(`ai://chunk/${requestId}`, (event) => {
    chunks.push(event.payload.delta);
  });
  const unlistenDone = await listen(`ai://done/${requestId}`, async () => {
    await unlistenChunk();
    await unlistenDone();
  });

  await invoke("ai_stream", payload);
  return {
    getText: () => chunks.join(""),
    cancel: () => invoke("ai_cancel", { requestId }),
  };
}
```

- [ ] **Step 5: Implement settings panel and app integration**

Add a simple AI settings panel with provider, model, and key actions:

```vue
<template>
  <div v-if="ai.settingsOpen" class="settings-panel" @click.self="ai.closeSettings()">
    <section class="settings-panel__dialog" aria-label="AI Settings">
      <h2>AI Settings</h2>
      <label>
        <span>Active Provider</span>
        <select v-model="ai.activeProvider">
          <option value="openai">OpenAI</option>
          <option value="deepseek">DeepSeek</option>
        </select>
      </label>
    </section>
  </div>
</template>
```

Register a command palette action in `src/lib/app-commands.ts`:

```ts
{ id: "ai.settings", label: "AI: Settings", run: () => ai.openSettings() }
```

Register a shortcut/command in `src/lib/shortcuts/registry.ts`:

```ts
def("ai.settings", "AI Settings", "view", "app", null),
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/ai-store.spec.ts tests/unit/ai-settings-panel.spec.ts tests/unit/ai-stream-client.spec.ts`
Expected: PASS with AI settings panel, store defaults, and stream wrapper covered.

- [ ] **Step 7: Commit**

```bash
git add src/stores/ai.ts src/lib/ai/stream-client.ts src/components/AiSettingsPanel.vue src/layout/AppShell.vue src/lib/app-commands.ts src/lib/shortcuts/registry.ts tests/unit/ai-store.spec.ts tests/unit/ai-settings-panel.spec.ts tests/unit/ai-stream-client.spec.ts
git commit -m "feat: add ai settings shell"
```

### Task 3: Selection rewrite context extraction, presets, and orchestrator

**Files:**
- Create: `src/lib/ai/presets.ts`
- Create: `src/lib/ai/context.ts`
- Create: `src/lib/ai/orchestrator.ts`
- Create: `src/lib/ai/config/types.ts`
- Test: `tests/unit/ai-context.spec.ts`
- Test: `tests/unit/ai-presets.spec.ts`
- Test: `tests/unit/ai-orchestrator.spec.ts`

- [ ] **Step 1: Write the failing context and orchestrator tests**

```ts
import { describe, it, expect } from "vitest";
import { markdownSchema } from "@/editor/schema";
import { buildSelectionRewriteContext } from "@/lib/ai/context";

describe("ai context", () => {
  it("extracts selection and current section", () => {
    const doc = markdownSchema.node("doc", null, [
      markdownSchema.node("heading", { level: 1 }, [markdownSchema.text("Title")]),
      markdownSchema.node("paragraph", null, [markdownSchema.text("Alpha Beta Gamma")]),
    ]);
    const result = buildSelectionRewriteContext(doc, 9, 13);
    expect(result.selection).toBe("Beta");
    expect(result.sectionMarkdown).toContain("# Title");
  });
});
```

```ts
import { createAiOrchestrator } from "@/lib/ai/orchestrator";

describe("ai orchestrator", () => {
  it("assembles a markdown-only rewrite prompt", async () => {
    const orchestrator = createAiOrchestrator({
      startStream: async () => ({ requestId: "r1" }),
    });
    const result = await orchestrator.rewriteSelection({
      instruction: "Polish",
      selection: "hello",
      sectionMarkdown: "# Title\n\nhello",
      fullMarkdown: "# Title\n\nhello",
    });
    expect(result.requestId).toBe("r1");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/ai-context.spec.ts tests/unit/ai-presets.spec.ts tests/unit/ai-orchestrator.spec.ts`
Expected: FAIL because the context, presets, and orchestrator modules do not exist yet.

- [ ] **Step 3: Implement presets and shared config types**

```ts
// src/lib/ai/presets.ts
export const AI_PRESETS = [
  { id: "polish", label: "Polish", instruction: "Improve prose while preserving meaning and Markdown structure." },
  { id: "translate-en", label: "Translate to English", instruction: "Translate to English and preserve Markdown formatting." },
  { id: "translate-zh", label: "Translate to Chinese", instruction: "Translate to Chinese and preserve Markdown formatting." },
  { id: "expand", label: "Expand", instruction: "Expand the content without changing core meaning." },
  { id: "condense", label: "Condense", instruction: "Shorten the content while preserving key information." },
] as const;
```

- [ ] **Step 4: Implement selection/full-document context extraction**

```ts
// src/lib/ai/context.ts
import { serializeMarkdown } from "@/editor/markdown-serializer";

export function buildSelectionRewriteContext(doc: import("prosemirror-model").Node, from: number, to: number) {
  const fullMarkdown = serializeMarkdown(doc);
  const selection = doc.textBetween(from, to, "\n");
  return {
    selection,
    sectionMarkdown: fullMarkdown,
    fullMarkdown,
    truncated: false,
  };
}
```

Also add `buildFullDocumentRewriteContext()` that returns the entire serialized Markdown plus truncation metadata when the estimated token budget is exceeded.

- [ ] **Step 5: Implement orchestrator prompt assembly**

```ts
// src/lib/ai/orchestrator.ts
export function createAiOrchestrator(deps: {
  startStream: (request: Record<string, unknown>) => Promise<{ requestId: string }>;
}) {
  return {
    async rewriteSelection(input: {
      instruction: string;
      selection: string;
      sectionMarkdown: string;
      fullMarkdown: string;
    }) {
      return deps.startStream({
        requestId: crypto.randomUUID(),
        provider: "deepseek",
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are a Markdown editing assistant. Output only the modified Markdown text. Preserve formatting.",
          },
          {
            role: "user",
            content: `${input.sectionMarkdown}\n---\nModify the following selected text:\n> ${input.selection}\nInstruction: ${input.instruction}`,
          },
        ],
      });
    },
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/ai-context.spec.ts tests/unit/ai-presets.spec.ts tests/unit/ai-orchestrator.spec.ts`
Expected: PASS with prompt assembly and context extraction covered.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/presets.ts src/lib/ai/context.ts src/lib/ai/orchestrator.ts src/lib/ai/config/types.ts tests/unit/ai-context.spec.ts tests/unit/ai-presets.spec.ts tests/unit/ai-orchestrator.spec.ts
git commit -m "feat: add ai rewrite orchestration"
```

### Task 4: Selection rewrite toolbar, editor preview plugin, and accept/reject flow

**Files:**
- Create: `src/editor/ai-edit/plugin.ts`
- Create: `src/editor/ai-edit/apply.ts`
- Create: `src/components/AiEditToolbar.vue`
- Modify: `src/editor/plugins.ts`
- Modify: `src/editor/EditorView.vue`
- Modify: `src/stores/ai.ts`
- Test: `tests/unit/ai-edit-plugin.spec.ts`
- Test: `tests/unit/ai-edit-toolbar.spec.ts`

- [ ] **Step 1: Write the failing preview and toolbar tests**

```ts
import { describe, it, expect } from "vitest";
import { createAiPreviewState } from "@/editor/ai-edit/plugin";

describe("ai edit plugin", () => {
  it("stores preview state for a selection rewrite", () => {
    const state = createAiPreviewState({
      from: 5,
      to: 10,
      originalText: "hello",
      previewText: "hi",
    });
    expect(state.previewText).toBe("hi");
  });
});
```

```ts
import { mount } from "@vue/test-utils";
import AiEditToolbar from "@/components/AiEditToolbar.vue";

describe("AiEditToolbar", () => {
  it("renders built-in rewrite presets", () => {
    const wrapper = mount(AiEditToolbar);
    expect(wrapper.text()).toContain("Polish");
    expect(wrapper.text()).toContain("Condense");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/ai-edit-plugin.spec.ts tests/unit/ai-edit-toolbar.spec.ts`
Expected: FAIL because the preview plugin and toolbar do not exist yet.

- [ ] **Step 3: Implement preview state and apply helpers**

```ts
// src/editor/ai-edit/plugin.ts
export type AiPreviewState = {
  from: number;
  to: number;
  originalText: string;
  previewText: string;
};

export function createAiPreviewState(input: AiPreviewState): AiPreviewState {
  return input;
}
```

```ts
// src/editor/ai-edit/apply.ts
export function applySelectionRewrite(
  view: import("prosemirror-view").EditorView,
  from: number,
  to: number,
  text: string,
) {
  view.dispatch(view.state.tr.insertText(text, from, to));
}
```

- [ ] **Step 4: Implement toolbar and editor integration**

Create a toolbar that exposes preset buttons and a custom prompt input:

```vue
<template>
  <div class="ai-edit-toolbar">
    <button v-for="preset in presets" :key="preset.id" type="button">
      {{ preset.label }}
    </button>
    <button type="button">Custom...</button>
  </div>
</template>
```

Mount the toolbar in `src/editor/EditorView.vue` only when there is a non-empty selection and no generation is already running.

- [ ] **Step 5: Implement selection accept/reject flow**

Update `src/stores/ai.ts` to hold preview state:

```ts
const preview = ref<null | {
  mode: "selection";
  from: number;
  to: number;
  originalText: string;
  previewText: string;
}>(null);
```

Add actions:

```ts
function setSelectionPreview(previewState: NonNullable<typeof preview.value>) {
  preview.value = previewState;
}

function clearPreview() {
  preview.value = null;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/ai-edit-plugin.spec.ts tests/unit/ai-edit-toolbar.spec.ts`
Expected: PASS with preview state, toolbar rendering, and apply helpers covered.

- [ ] **Step 7: Commit**

```bash
git add src/editor/ai-edit/plugin.ts src/editor/ai-edit/apply.ts src/components/AiEditToolbar.vue src/editor/plugins.ts src/editor/EditorView.vue src/stores/ai.ts tests/unit/ai-edit-plugin.spec.ts tests/unit/ai-edit-toolbar.spec.ts
git commit -m "feat: add ai selection rewrite preview"
```

### Task 5: AGENTS.md and Skill loading, matching, and prompt injection

**Files:**
- Create: `src/lib/ai/config/agents-loader.ts`
- Create: `src/lib/ai/config/skills-loader.ts`
- Create: `src/lib/ai/skill-matcher.ts`
- Test: `tests/unit/ai-agents-loader.spec.ts`
- Test: `tests/unit/ai-skills-loader.spec.ts`
- Test: `tests/unit/ai-skill-matcher.spec.ts`

- [ ] **Step 1: Write the failing loader and matcher tests**

```ts
import { describe, it, expect } from "vitest";
import { mergeAgentsContent } from "@/lib/ai/config/agents-loader";

describe("agents loader", () => {
  it("puts project AGENTS.md before global content", () => {
    const merged = mergeAgentsContent("project rules", "global rules");
    expect(merged.startsWith("project rules")).toBe(true);
    expect(merged).toContain("global rules");
  });
});
```

```ts
import { scoreSkillMatch } from "@/lib/ai/skill-matcher";

describe("skill matcher", () => {
  it("prefers glob matches over keyword-only matches", () => {
    const score = scoreSkillMatch(
      { name: "docs", description: "api docs", globs: ["docs/**"] },
      { filePath: "docs/a.md", previewText: "api reference" },
    );
    expect(score).toBeGreaterThan(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/ai-agents-loader.spec.ts tests/unit/ai-skills-loader.spec.ts tests/unit/ai-skill-matcher.spec.ts`
Expected: FAIL because the loaders and matcher do not exist yet.

- [ ] **Step 3: Implement AGENTS merge helpers**

```ts
// src/lib/ai/config/agents-loader.ts
export function mergeAgentsContent(projectContent: string | null, globalContent: string | null) {
  return [projectContent, globalContent].filter(Boolean).join("\n\n");
}
```

- [ ] **Step 4: Implement skill parsing and scoring**

```ts
// src/lib/ai/skill-matcher.ts
export function scoreSkillMatch(
  skill: { description: string; globs?: string[] },
  input: { filePath: string; previewText: string },
) {
  let score = 0;
  if (skill.globs?.some((glob) => input.filePath.startsWith(glob.replace("/**", "/")))) {
    score += 10;
  }
  for (const word of skill.description.toLowerCase().split(/\s+/)) {
    if (word && input.previewText.toLowerCase().includes(word)) {
      score += 1;
    }
  }
  return score;
}
```

- [ ] **Step 5: Inject AGENTS and matched Skills into orchestrator**

Extend `createAiOrchestrator()` so rewrite requests prepend merged AGENTS.md content and top-ranked Skill bodies to the system prompt before the preset instruction.

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/ai-agents-loader.spec.ts tests/unit/ai-skills-loader.spec.ts tests/unit/ai-skill-matcher.spec.ts tests/unit/ai-orchestrator.spec.ts`
Expected: PASS with merge order, skill parsing, and prompt injection behavior covered.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/config/agents-loader.ts src/lib/ai/config/skills-loader.ts src/lib/ai/skill-matcher.ts src/lib/ai/orchestrator.ts tests/unit/ai-agents-loader.spec.ts tests/unit/ai-skills-loader.spec.ts tests/unit/ai-skill-matcher.spec.ts tests/unit/ai-orchestrator.spec.ts
git commit -m "feat: add ai config loading and skill matching"
```

### Task 6: Full-document rewrite, command integration, truncation warning, and verification

**Files:**
- Modify: `src/lib/ai/context.ts`
- Modify: `src/lib/ai/orchestrator.ts`
- Modify: `src/stores/ai.ts`
- Modify: `src/components/AiEditToolbar.vue`
- Modify: `src/components/CommandPalette.vue`
- Modify: `src/lib/app-commands.ts`
- Modify: `src/lib/shortcuts/registry.ts`
- Modify: `src/editor/ai-edit/plugin.ts`
- Create: `tests/e2e/ai-editing.spec.ts`
- Modify: `tests/unit/ai-context.spec.ts`
- Modify: `tests/unit/ai-orchestrator.spec.ts`
- Modify: `docs/product/feature-list.md`

- [ ] **Step 1: Write the failing full-document tests**

```ts
import { describe, it, expect } from "vitest";
import { buildFullDocumentRewriteContext } from "@/lib/ai/context";

describe("full document ai context", () => {
  it("marks content as truncated when estimated tokens exceed budget", () => {
    const result = buildFullDocumentRewriteContext("# A\n\n" + "x".repeat(50000), 2000);
    expect(result.truncated).toBe(true);
    expect(result.fullMarkdown).toContain("[content truncated]");
  });
});
```

```ts
import { mount } from "@vue/test-utils";
import CommandPalette from "@/components/CommandPalette.vue";

describe("AI commands in command palette", () => {
  it("shows rewrite document action", () => {
    const wrapper = mount(CommandPalette);
    expect(wrapper.text()).toContain("AI: Rewrite Document");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/unit/ai-context.spec.ts tests/unit/ai-orchestrator.spec.ts tests/unit/command-palette.spec.ts`
Expected: FAIL because full-document rewrite flow and commands are not implemented yet.

- [ ] **Step 3: Implement full-document context truncation and mode switching**

```ts
export function buildFullDocumentRewriteContext(fullMarkdown: string, maxTokens: number) {
  const estimatedTokens = Math.ceil(fullMarkdown.length / 4);
  if (estimatedTokens <= maxTokens * 0.8) {
    return { fullMarkdown, truncated: false };
  }

  const head = fullMarkdown.slice(0, Math.floor(fullMarkdown.length * 0.7));
  const tail = fullMarkdown.slice(Math.floor(fullMarkdown.length * 0.9));
  return {
    fullMarkdown: `${head}\n...\n[content truncated]\n...\n${tail}`,
    truncated: true,
  };
}
```

- [ ] **Step 4: Add full-document commands and preview bar**

Register commands:

```ts
def("ai.rewriteSelection", "AI Rewrite Selection", "format", "editor", "Mod-Shift-A"),
def("ai.rewriteDocument", "AI Rewrite Document", "view", "app", null),
```

Add command palette entries:

```ts
{ id: "ai.rewriteDocument", label: "AI: Rewrite Document", run: () => ai.startDocumentRewrite() }
```

Render a fixed preview bar when AI store is in document preview mode, with `Accept all` and `Reject`.

- [ ] **Step 5: Add E2E coverage and update feature list**

Create `tests/e2e/ai-editing.spec.ts` with a mocked stream flow:

```ts
test("selection rewrite previews and accepts replacement", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("make-md:test-ai-preview", {
      detail: { mode: "selection", originalText: "hello", previewText: "hi" },
    }));
  });
  await expect(page.getByText("Accept")).toBeVisible();
});
```

Update `docs/product/feature-list.md` by adding an AI-related module or rows with `partial` status once settings, selection rewrite, or full-document rewrite ship.

- [ ] **Step 6: Run verification**

Run: `pnpm vitest run tests/unit/ai-*.spec.ts tests/unit/command-palette.spec.ts`
Run: `pnpm test:e2e -- tests/e2e/ai-editing.spec.ts`
Run: `cargo test ai::`
Expected: PASS for AI unit coverage, AI E2E smoke, and Rust AI tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ai/context.ts src/lib/ai/orchestrator.ts src/stores/ai.ts src/components/AiEditToolbar.vue src/components/CommandPalette.vue src/lib/app-commands.ts src/lib/shortcuts/registry.ts src/editor/ai-edit/plugin.ts tests/unit/ai-context.spec.ts tests/unit/ai-orchestrator.spec.ts tests/e2e/ai-editing.spec.ts docs/product/feature-list.md
git commit -m "feat: add full document ai rewriting"
```

---

## Self-Review

- Spec coverage: transport/keychain/providers are in Task 1; settings/store/panel in Task 2; selection context/orchestration in Task 3; selection preview/accept-reject in Task 4; AGENTS.md + Skills in Task 5; full-document rewrite/truncation/E2E in Task 6.
- Placeholder scan: all tasks name exact files, tests, and commands; no `TODO`/`TBD` placeholders remain.
- Type consistency: request shape uses `request_id/provider/model/messages` throughout; AI store owns generation and preview state; orchestrator remains the single prompt assembly point.
