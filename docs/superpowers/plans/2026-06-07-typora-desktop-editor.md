# Typora Desktop Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tauri + Vue 3 + TypeScript desktop writing app that matches Typora's core writing workflow, local file management, live Markdown rendering, auto-save, and recovery, while excluding paid/licensing features.

**Architecture:** The app is split into a thin Tauri/Rust platform layer for file system and OS integration, a Vue 3 UI shell for workspace navigation and settings, and a ProseMirror-based editor core for Typora-style rich Markdown editing. Markdown serialization, file lifecycle, recovery, and export stay in dedicated modules so editor behavior stays testable and the platform layer remains replaceable.

**Tech Stack:** Tauri, Rust, Vue 3, TypeScript, Vite, Pinia, ProseMirror, Vitest, Playwright, CSS variables.

## Implementation Status (2026-06-07)

| Task | Status | Notes |
|------|--------|-------|
| Task 1 Scaffold | ✅ Complete | Committed `ec7fd51` |
| Task 2 Shell | ✅ Complete | Committed `9563442` |
| Task 3 File workflow | ✅ Complete | Committed `8fcb530` |
| Task 4 Editor core | ⚠️ Partial | Core blocks, tables, tasks, Mermaid, inline marks (bold/italic/code/strike/link + ⌘B/I/E/K); missing math, footnotes, front matter, TOC, syntax highlight |
| Task 5 Autosave/recovery | ✅ Complete | Committed `c54e2e9` |
| Task 6 Verification | ⚠️ Partial | `phase-1-verification.md` + README; E2E smoke in `tests/e2e/`; cross-platform not rigorously verified |

**Beyond Phase 1 plan (already shipped):** Mermaid preview, HTML/PDF export, command palette, focus mode, theme toggle, tab close + unsaved prompts, Phase 2 folder workspace, outline, find/replace, image assets, inline editing module.

**Next:** Phase 3 — editor depth (math, footnotes, syntax highlight, large-file perf). Phase 2 complete.

---

## Phase 2 Status (2026-06-07)

| Milestone | Status |
|-----------|--------|
| M1 Folder open + tree + watch | ✅ |
| M2 File CRUD + reveal + drag | ✅ |
| M3 Outline panel | ✅ |
| M4 Find/replace | ✅ |
| M5 Image paste/drop | ✅ |
| M6 PDF export (macOS) | ✅ |
| M7 Docs + E2E smoke | ✅ |

**Inline editing (post Phase 2):** Typora hybrid marks module — bold/italic/code/strike/link, ⌘B/I/E/K, decorations, paste SSOT. See `docs/superpowers/plans/2026-06-07-inline-editing.md`.

---

### Task 1: Scaffold the desktop app and development toolchain

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `src/main.ts`
- Create: `src/App.vue`
- Create: `src/styles/app.css`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`
- Create: `eslint.config.js`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`

- [x] **Step 1: Create the failing smoke test**

```ts
import { describe, it, expect } from "vitest";

describe("app scaffold", () => {
  it("exports a mountable root component", async () => {
    const { default: App } = await import("../../src/App.vue");
    expect(App).toBeTruthy();
  });
});
```

- [x] **Step 2: Run the smoke test before the scaffold exists**

Run: `pnpm vitest run tests/unit/app-smoke.spec.ts -v`
Expected: fail because the project files and Vitest setup do not exist yet.

- [x] **Step 3: Add the minimal scaffold and toolchain files**

Create a Vite + Vue 3 + TypeScript desktop entry that mounts a blank shell, wires Tauri startup, and defines lint/test/build scripts for the rest of the work.

- [x] **Step 4: Run the smoke test and app build**

Run:

```bash
pnpm install
pnpm vitest run tests/unit/app-smoke.spec.ts -v
pnpm build
pnpm tauri build
```

Expected: the test passes, the web build succeeds, and the Tauri build reaches the packaging stage for the default app shell.

- [x] **Step 5: Commit the scaffold**

```bash
git add package.json pnpm-workspace.yaml index.html vite.config.ts tsconfig.json tsconfig.node.json src src-tauri eslint.config.js vitest.config.ts playwright.config.ts
git commit -m "chore: scaffold tauri vue app"
```

### Task 2: Build the Typora-style application shell and workspace layout

**Files:**
- Create: `src/layout/AppShell.vue`
- Create: `src/components/Sidebar.vue`
- Create: `src/components/EditorPane.vue`
- Create: `src/components/StatusBar.vue`
- Create: `src/components/TabStrip.vue`
- Create: `src/components/CommandPalette.vue`
- Create: `src/stores/ui.ts`
- Create: `src/stores/workspace.ts`
- Modify: `src/App.vue`
- Modify: `src/styles/app.css`

- [x] **Step 1: Write a shell layout test**

```ts
import { mount } from "@vue/test-utils";
import AppShell from "../../src/layout/AppShell.vue";

describe("AppShell", () => {
  it("renders sidebar, editor pane, and status bar regions", () => {
    const wrapper = mount(AppShell);
    expect(wrapper.find("[data-testid='sidebar']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='editor-pane']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='status-bar']").exists()).toBe(true);
  });
});
```

- [x] **Step 2: Run the layout test before implementation**

Run: `pnpm vitest run tests/unit/app-shell.spec.ts -v`
Expected: fail because the shell components do not exist yet.

- [x] **Step 3: Implement the shell and global layout styles**

Add a three-pane desktop layout with a left workspace sidebar, center editor canvas, and bottom status bar, plus a tab strip for multiple documents and a command palette entry point.

- [x] **Step 4: Run the layout test and a browser smoke check**

Run:

```bash
pnpm vitest run tests/unit/app-shell.spec.ts -v
pnpm tauri dev
```

Expected: layout test passes and the app opens with the shell visible and responsive.

- [x] **Step 5: Commit the shell work**

```bash
git add src/App.vue src/layout src/components src/stores src/styles/app.css tests/unit/app-shell.spec.ts
git commit -m "feat: add workspace shell"
```

### Task 3: Implement local file open/save and recent-document workflow

**Files:**
- Create: `src-tauri/src/fs.rs`
- Create: `src-tauri/src/workspace.rs`
- Create: `src-tauri/src/recent.rs`
- Create: `src/lib/file-path.ts`
- Create: `src/lib/document-session.ts`
- Create: `src/lib/file-service.ts`
- Create: `src/stores/documents.ts`
- Modify: `src-tauri/src/main.rs`
- Modify: `src/stores/workspace.ts`
- Modify: `src/layout/AppShell.vue`

- [x] **Step 1: Write the document lifecycle test**

```ts
import { describe, it, expect } from "vitest";
import { createDocumentSession } from "../../src/lib/document-session";

describe("document session", () => {
  it("tracks path, dirty state, and last saved content", () => {
    const session = createDocumentSession({
      id: "doc-1",
      path: "/tmp/note.md",
      content: "# Hello",
    });

    session.markDirty();
    expect(session.isDirty()).toBe(true);
    session.markSaved("# Hello");
    expect(session.isDirty()).toBe(false);
  });
});
```

- [x] **Step 2: Run the lifecycle test before implementation**

Run: `pnpm vitest run tests/unit/document-session.spec.ts -v`
Expected: fail because the document session and file service modules do not exist yet.

- [x] **Step 3: Implement the local file service and recent-file store**

Add open, save, save-as, recent file persistence, and safe path normalization so workspace state survives app restarts and the shell can reopen recent notes.

- [x] **Step 4: Verify open/save against a real markdown file**

Run:

```bash
pnpm vitest run tests/unit/document-session.spec.ts -v
pnpm tauri dev
```

Expected: the app opens local `.md` files, saves edits back to disk, and shows recent documents after restart.

- [x] **Step 5: Commit the file workflow**

```bash
git add src-tauri/src/fs.rs src-tauri/src/workspace.rs src-tauri/src/recent.rs src/lib src/stores tests/unit/document-session.spec.ts
git commit -m "feat: add local file workflow"
```

### Task 4: Build the Markdown editor core on ProseMirror

**Files:**
- Create: `src/editor/schema.ts`
- Create: `src/editor/plugins.ts`
- Create: `src/editor/commands.ts`
- Create: `src/editor/input-rules.ts`
- Create: `src/editor/markdown-serializer.ts`
- Create: `src/editor/markdown-parser.ts`
- Create: `src/editor/EditorView.vue`
- Modify: `src/components/EditorPane.vue`
- Modify: `src/stores/documents.ts`

- [x] **Step 1: Write a schema round-trip test**

```ts
import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { serializeMarkdown } from "../../src/editor/markdown-serializer";

describe("markdown round trip", () => {
  it("preserves headings, lists, and code blocks", () => {
    const source = "# Title\n\n- a\n- b\n\n```ts\nconst n = 1;\n```";
    const doc = parseMarkdown(source);
    expect(serializeMarkdown(doc)).toContain("# Title");
    expect(serializeMarkdown(doc)).toContain("- a");
    expect(serializeMarkdown(doc)).toContain("const n = 1;");
  });
});
```

- [x] **Step 2: Run the round-trip test before implementation**

Run: `pnpm vitest run tests/unit/markdown-roundtrip.spec.ts -v`
Expected: fail because the parser and serializer are not implemented yet.

- [ ] **Step 3: Implement the editor schema and Markdown conversion**

Define block nodes for headings, paragraphs, lists, tasks, quotes, code blocks, tables, images, math, footnotes, front matter, and TOC. Implement commands and input rules for Typora-style block conversion and line editing.

> **Partial:** Headings, lists, tasks, quotes, code blocks, tables, images, inline marks, input rules, and Mermaid code-block preview are done. Math, footnotes, front matter, TOC, and syntax highlighting remain.

- [x] **Step 4: Mount the editor into the shell**

Wire `EditorPane` to a ProseMirror editor view, connect document sessions to the active tab, and make edits update the dirty state and autosave queue.

- [x] **Step 5: Verify the editor against a sample document**

Run:

```bash
pnpm vitest run tests/unit/markdown-roundtrip.spec.ts -v
pnpm tauri dev
```

Expected: headings, lists, and code blocks render and edit correctly in the app shell.

- [x] **Step 6: Commit the editor core**

```bash
git add src/editor src/components/EditorPane.vue src/stores/documents.ts tests/unit/markdown-roundtrip.spec.ts
git commit -m "feat: add markdown editor core"
```

### Task 5: Add autosave, crash recovery, and unsaved-change protection

**Files:**
- Create: `src/lib/autosave.ts`
- Create: `src/lib/recovery.ts`
- Create: `src-tauri/src/recovery.rs`
- Modify: `src/stores/documents.ts`
- Modify: `src-tauri/src/main.rs`

- [x] **Step 1: Write an autosave behavior test**

```ts
import { describe, it, expect } from "vitest";
import { createAutosaveQueue } from "../../src/lib/autosave";

describe("autosave queue", () => {
  it("coalesces rapid edits into one pending save", async () => {
    const writes: string[] = [];
    const queue = createAutosaveQueue(async (content) => {
      writes.push(content);
    });

    queue.schedule("first");
    queue.schedule("second");
    await queue.flush();
    expect(writes).toEqual(["second"]);
  });
});
```

- [x] **Step 2: Run the autosave test before implementation**

Run: `pnpm vitest run tests/unit/autosave.spec.ts -v`
Expected: fail because the queue and recovery modules do not exist yet.

- [x] **Step 3: Implement autosave and recovery**

Queue document writes, persist recovery snapshots, detect dirty tabs on close, and restore unsaved content after a crash or forced quit.

- [x] **Step 4: Verify restart recovery**

Run:

```bash
pnpm vitest run tests/unit/autosave.spec.ts -v
pnpm tauri dev
```

Expected: unsaved edits are restored after relaunch and closing a dirty document prompts the user instead of discarding changes.

- [x] **Step 5: Commit recovery support**

```bash
git add src/lib/autosave.ts src/lib/recovery.ts src-tauri/src/recovery.rs src/stores/documents.ts tests/unit/autosave.spec.ts
git commit -m "feat: add autosave and recovery"
```

### Task 6: Add the first production verification sweep and release notes

**Files:**
- Create: `docs/notes/phase-1-verification.md`
- Modify: `README.md`
- Modify: `.gitignore`

- [x] **Step 1: Write a verification checklist**

```md
- Launches on macOS, Windows, and Linux
- Opens a local markdown file
- Edits headings, lists, code blocks, tables, and images
- Saves and reopens without data loss
- Restores unsaved content after restart
- Passes unit tests for markdown round-trip, document sessions, and autosave
```

- [x] **Step 2: Run the full local verification**

Run:

```bash
pnpm test
pnpm build
pnpm tauri build
```

Expected: all tests pass, the web build succeeds, and the desktop build reaches packaging for the first release candidate.

> **Gap:** Playwright E2E tests not written (`playwright.config.ts` exists, `tests/e2e/` empty). Cross-platform launch marked done but not rigorously verified on all OSes.

- [x] **Step 3: Commit the verification docs**

```bash
git add README.md .gitignore docs/notes/phase-1-verification.md
git commit -m "docs: add phase 1 verification notes"
```
