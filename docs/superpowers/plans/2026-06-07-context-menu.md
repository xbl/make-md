# Context Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a shared frontend context menu for the editor, file tree, and tab strip, and implement prompt-driven table insertion through `paragraph.table`.

**Architecture:** Add a reusable context-menu component plus a small controller utility, then adapt each UI surface to supply menu items from its own state. Keep editor behavior centralized by implementing `paragraph.table` in the existing editor command event plugin and routing editor right-click items through the same command ids used by menus and shortcuts.

**Tech Stack:** Vue 3 SFCs, Pinia, TypeScript, ProseMirror, Vitest, Vue Test Utils

---

## File Structure

- Create: `src/components/ContextMenu.vue`
  - Shared popup menu renderer with item buttons, separators, disabled state, and viewport positioning.
- Create: `src/lib/context-menu.ts`
  - Generic item types plus open/close controller helpers shared by editor, file tree, and tab strip.
- Modify: `src/editor/editor-command-events.ts`
  - Add `paragraph.table` prompt flow and Markdown table insertion helpers.
- Modify: `src/editor/EditorView.vue`
  - Open shared context menu on right-click and dispatch editor actions through existing command ids or clipboard handlers.
- Modify: `src/components/FileTreeNode.vue`
  - Replace inline menu markup/state with the shared context menu and keep existing file/folder actions.
- Modify: `src/components/TabStrip.vue`
  - Add right-click support and tab actions including close others and reveal in finder.
- Modify: `src/stores/documents.ts`
  - Add helper to close all tabs except a target tab while preserving existing unsaved-change prompts.
- Modify: `src/styles/app.css`
  - Add reusable context menu styling.
- Test: `tests/unit/editor-command-events.spec.ts`
  - Cover `paragraph.table` cancel, validation, and successful insertion.
- Test: `tests/unit/context-menu.spec.ts`
  - Cover shared menu rendering and close behavior.
- Test: `tests/unit/tab-strip.spec.ts`
  - Cover right-click tab actions.
- Test: `tests/unit/file-tree-node.spec.ts`
  - Cover shared file tree context menu behavior and action wiring.

### Task 1: Implement Table Command in the Editor

**Files:**
- Modify: `src/editor/editor-command-events.ts`
- Test: `tests/unit/editor-command-events.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("does nothing when paragraph.table is canceled at the column prompt", () => {
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  const promptSpy = vi.spyOn(window, "prompt").mockReturnValueOnce(null);

  const state = EditorState.create({
    schema: markdownSchema,
    doc: markdownSchema.node("doc", null, [
      markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
    ]),
    plugins: createEditorPlugins(),
  });

  const view = new EditorView(mount, { state });
  const before = view.state.doc.textContent;

  window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.table" } }));

  expect(promptSpy).toHaveBeenCalledWith("Table column count", "3");
  expect(view.state.doc.textContent).toBe(before);

  promptSpy.mockRestore();
  view.destroy();
  document.body.removeChild(mount);
});

it("alerts and does not mutate the document when paragraph.table gets an invalid column count", () => {
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  const promptSpy = vi.spyOn(window, "prompt")
    .mockReturnValueOnce("0");
  const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

  const state = EditorState.create({
    schema: markdownSchema,
    doc: markdownSchema.node("doc", null, [
      markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
    ]),
    plugins: createEditorPlugins(),
  });

  const view = new EditorView(mount, { state });
  const before = view.state.doc.textContent;

  window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.table" } }));

  expect(alertSpy).toHaveBeenCalledWith("Table size must be a positive integer");
  expect(view.state.doc.textContent).toBe(before);

  alertSpy.mockRestore();
  promptSpy.mockRestore();
  view.destroy();
  document.body.removeChild(mount);
});

it("inserts a markdown table when paragraph.table receives valid dimensions", () => {
  const mount = document.createElement("div");
  document.body.appendChild(mount);
  const promptSpy = vi.spyOn(window, "prompt")
    .mockReturnValueOnce("3")
    .mockReturnValueOnce("2");

  const state = EditorState.create({
    schema: markdownSchema,
    doc: markdownSchema.node("doc", null, [
      markdownSchema.node("paragraph", null, [markdownSchema.text("Hello")]),
    ]),
    plugins: createEditorPlugins(),
  });

  const view = new EditorView(mount, { state });

  window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId: "paragraph.table" } }));

  const text = view.state.doc.textBetween(0, view.state.doc.content.size, "\n", "\n");
  expect(promptSpy).toHaveBeenNthCalledWith(1, "Table column count", "3");
  expect(promptSpy).toHaveBeenNthCalledWith(2, "Table row count", "2");
  expect(text).toContain("|   |   |   |");
  expect(text).toContain("| --- | --- | --- |");

  promptSpy.mockRestore();
  view.destroy();
  document.body.removeChild(mount);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/editor-command-events.spec.ts`
Expected: FAIL with missing `paragraph.table` behavior assertions.

- [ ] **Step 3: Write minimal implementation**

```ts
function promptPositiveInteger(label: string, fallback: string): number | null {
  const value = window.prompt(label, fallback);
  if (value === null) {
    return null;
  }

  const trimmed = value.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) {
    window.alert("Table size must be a positive integer");
    return null;
  }

  return Number(trimmed);
}

function buildMarkdownTable(columns: number, rows: number): string {
  const cell = "   ";
  const header = `|${Array.from({ length: columns }, () => ` ${cell} `).join("|")}|`;
  const separator = `|${Array.from({ length: columns }, () => " --- ").join("|")}|`;
  const body = Array.from({ length: rows }, () => header);
  return [header, separator, ...body].join("\n");
}

function insertTable(view: import("prosemirror-view").EditorView, columns: number, rows: number): boolean {
  const table = buildMarkdownTable(columns, rows);
  const { from, to } = view.state.selection;
  const tr = view.state.tr.insertText(table, from, to);
  view.dispatch(tr);
  view.focus();
  return true;
}

function applyTableCommand(view: import("prosemirror-view").EditorView): boolean {
  const columns = promptPositiveInteger("Table column count", "3");
  if (columns === null) {
    return false;
  }

  const rows = promptPositiveInteger("Table row count", "2");
  if (rows === null) {
    return false;
  }

  return insertTable(view, columns, rows);
}

// inside onEditorCommand
if (commandId === "paragraph.table") {
  void applyTableCommand(view);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/editor-command-events.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/editor/editor-command-events.ts tests/unit/editor-command-events.spec.ts
git commit -m "feat: add table insert editor command"
```

### Task 2: Build the Shared Context Menu Primitive

**Files:**
- Create: `src/components/ContextMenu.vue`
- Create: `src/lib/context-menu.ts`
- Modify: `src/styles/app.css`
- Test: `tests/unit/context-menu.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ContextMenu from "@/components/ContextMenu.vue";

describe("ContextMenu", () => {
  it("renders menu items and closes on Escape", async () => {
    const onClose = vi.fn();
    const onRun = vi.fn();

    const wrapper = mount(ContextMenu, {
      attachTo: document.body,
      props: {
        open: true,
        x: 24,
        y: 48,
        items: [
          { id: "open", label: "Open", run: onRun },
          { id: "sep", type: "separator" },
          { id: "disabled", label: "Delete", disabled: true, run: vi.fn() },
        ],
        onClose,
      },
    });

    expect(wrapper.text()).toContain("Open");
    expect(wrapper.text()).toContain("Delete");

    await wrapper.find(".context-menu").trigger("keydown", { key: "Escape" });
    await nextTick();

    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/context-menu.spec.ts`
Expected: FAIL because `ContextMenu.vue` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/context-menu.ts
export type ContextMenuAction = {
  id: string;
  label?: string;
  shortcut?: string;
  disabled?: boolean;
  type?: "action" | "separator";
  run?: () => void | Promise<void>;
};

export function isActionItem(item: ContextMenuAction) {
  return item.type !== "separator";
}
```

```vue
<!-- src/components/ContextMenu.vue -->
<template>
  <div
    v-if="open"
    class="context-menu"
    tabindex="-1"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @keydown.esc.prevent="emit('close')"
  >
    <template v-for="item in items" :key="item.id">
      <div v-if="item.type === 'separator'" class="context-menu__separator"></div>
      <button
        v-else
        type="button"
        class="context-menu__item"
        :disabled="item.disabled"
        @click="runItem(item)"
      >
        <span>{{ item.label }}</span>
        <span v-if="item.shortcut" class="context-menu__shortcut">{{ item.shortcut }}</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { ContextMenuAction } from "@/lib/context-menu";

const props = defineProps<{
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuAction[];
}>();

const emit = defineEmits<{
  close: [];
}>();

async function runItem(item: ContextMenuAction) {
  if (item.disabled || item.type === "separator") {
    return;
  }
  emit("close");
  await item.run?.();
}
</script>
```

```css
.context-menu {
  position: fixed;
  z-index: 40;
  min-width: 180px;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/context-menu.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ContextMenu.vue src/lib/context-menu.ts src/styles/app.css tests/unit/context-menu.spec.ts
git commit -m "feat: add shared context menu component"
```

### Task 3: Migrate File Tree to the Shared Menu

**Files:**
- Modify: `src/components/FileTreeNode.vue`
- Test: `tests/unit/file-tree-node.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import FileTreeNode from "@/components/FileTreeNode.vue";

describe("FileTreeNode", () => {
  it("opens the shared menu for files and runs rename", async () => {
    const wrapper = mount(FileTreeNode, {
      attachTo: document.body,
      props: {
        node: { name: "note.md", path: "/tmp/note.md", kind: "file", children: [] },
        depth: 0,
      },
      global: {
        plugins: [createPinia()],
      },
    });

    await wrapper.find(".file-tree__row--file").trigger("contextmenu", {
      clientX: 40,
      clientY: 60,
    });

    expect(wrapper.findComponent({ name: "ContextMenu" }).exists()).toBe(true);
    expect(wrapper.text()).toContain("Rename");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/file-tree-node.spec.ts`
Expected: FAIL because no file tree context-menu test file exists yet.

- [ ] **Step 3: Write minimal implementation**

```ts
const menu = reactive({
  open: false,
  x: 0,
  y: 0,
});

const menuItems = computed<ContextMenuAction[]>(() => {
  if (props.node.kind === "folder") {
    return [
      { id: "new", label: "New File", run: createFile },
      { id: "reveal", label: "Reveal in Finder", run: revealFile },
    ];
  }

  return [
    { id: "open", label: "Open", run: openFile },
    { id: "rename", label: "Rename", run: renameFile },
    { id: "delete", label: "Delete", run: deleteFile },
    { id: "reveal", label: "Reveal in Finder", run: revealFile },
  ];
});

function openMenu(event: MouseEvent) {
  folderWorkspace.setSelectedPath(props.node.path);
  menu.open = true;
  menu.x = event.clientX;
  menu.y = event.clientY;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/file-tree-node.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FileTreeNode.vue tests/unit/file-tree-node.spec.ts
git commit -m "feat: move file tree menu to shared context menu"
```

### Task 4: Add Tab Strip Context Menu and Close-Others Support

**Files:**
- Modify: `src/components/TabStrip.vue`
- Modify: `src/stores/documents.ts`
- Test: `tests/unit/tab-strip.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import TabStrip from "@/components/TabStrip.vue";
import { useDocumentsStore } from "@/stores/documents";

describe("TabStrip", () => {
  it("opens a context menu and exposes close others", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    documents.createNewDocument();
    documents.createNewDocument();

    const wrapper = mount(TabStrip, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await wrapper.find(".tab").trigger("contextmenu", { clientX: 80, clientY: 24 });

    expect(wrapper.text()).toContain("Close Others");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/tab-strip.spec.ts`
Expected: FAIL because the tab context menu does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
// in documents store
async closeOtherSessions(keepId: string) {
  for (const session of [...this.sessions]) {
    if (session.id === keepId) {
      continue;
    }

    const closed = await this.closeSession(session.id);
    if (!closed) {
      return false;
    }
  }

  this.activeSessionId = keepId;
  return true;
}
```

```ts
// in TabStrip.vue
const menu = reactive({ open: false, x: 0, y: 0, sessionId: "" });

const menuItems = computed<ContextMenuAction[]>(() => {
  const session = documents.sessions.find((item) => item.id === menu.sessionId);
  if (!session) {
    return [];
  }

  return [
    { id: "close", label: "Close", run: () => closeTab(session.id) },
    {
      id: "close-others",
      label: "Close Others",
      disabled: documents.sessions.length < 2,
      run: () => documents.closeOtherSessions(session.id),
    },
    {
      id: "reveal",
      label: "Reveal in Finder",
      disabled: !session.path,
      run: () => revealInFinder(session.path),
    },
  ];
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/tab-strip.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/TabStrip.vue src/stores/documents.ts tests/unit/tab-strip.spec.ts
git commit -m "feat: add tab context menu actions"
```

### Task 5: Add Editor Context Menu and Clipboard Actions

**Files:**
- Modify: `src/editor/EditorView.vue`
- Modify: `src/styles/app.css`
- Test: `tests/unit/app-shell.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("shows the editor context menu on right click when an editor session is active", async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const documents = useDocumentsStore();
  documents.createNewDocument();

  const wrapper = mount(AppShell, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
    },
  });

  await wrapper.find(".editor-view").trigger("contextmenu", {
    clientX: 100,
    clientY: 120,
  });

  expect(wrapper.text()).toContain("Insert Table");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/unit/app-shell.spec.ts`
Expected: FAIL because the editor context menu does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
const menu = reactive({
  open: false,
  x: 0,
  y: 0,
});

async function runClipboardAction(kind: "cut" | "copy" | "paste") {
  if (!view) {
    return;
  }

  if (kind === "copy") {
    const text = view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, "\n");
    await navigator.clipboard.writeText(text);
    return;
  }

  if (kind === "paste") {
    const text = await navigator.clipboard.readText();
    view.dispatch(view.state.tr.insertText(text, view.state.selection.from, view.state.selection.to));
    return;
  }

  const text = view.state.doc.textBetween(view.state.selection.from, view.state.selection.to, "\n");
  await navigator.clipboard.writeText(text);
  view.dispatch(view.state.tr.deleteSelection());
}

const menuItems = computed<ContextMenuAction[]>(() => [
  { id: "cut", label: "Cut", disabled: !view || view.state.selection.empty, run: () => runClipboardAction("cut") },
  { id: "copy", label: "Copy", disabled: !view || view.state.selection.empty, run: () => runClipboardAction("copy") },
  { id: "paste", label: "Paste", disabled: !view, run: () => runClipboardAction("paste") },
  { id: "sep-edit", type: "separator" },
  { id: "select-all", label: "Select All", run: () => dispatchEditorCommand("edit.selectAll") },
  { id: "bold", label: "Bold", run: () => dispatchEditorCommand("format.bold") },
  { id: "italic", label: "Italic", run: () => dispatchEditorCommand("format.italic") },
  { id: "code", label: "Inline Code", run: () => dispatchEditorCommand("format.inlineCode") },
  { id: "sep-block", type: "separator" },
  { id: "h1", label: "Heading 1", run: () => dispatchEditorCommand("paragraph.h1") },
  { id: "h2", label: "Heading 2", run: () => dispatchEditorCommand("paragraph.h2") },
  { id: "h3", label: "Heading 3", run: () => dispatchEditorCommand("paragraph.h3") },
  { id: "paragraph", label: "Paragraph", run: () => dispatchEditorCommand("paragraph.paragraph") },
  { id: "table", label: "Insert Table", run: () => dispatchEditorCommand("paragraph.table") },
]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/unit/app-shell.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/editor/EditorView.vue src/styles/app.css tests/unit/app-shell.spec.ts
git commit -m "feat: add editor context menu"
```

### Task 6: Run the Focused Verification Suite

**Files:**
- Test: `tests/unit/context-menu.spec.ts`
- Test: `tests/unit/file-tree-node.spec.ts`
- Test: `tests/unit/tab-strip.spec.ts`
- Test: `tests/unit/editor-command-events.spec.ts`
- Test: `tests/unit/app-shell.spec.ts`

- [ ] **Step 1: Run the focused unit suite**

Run: `pnpm test -- tests/unit/context-menu.spec.ts tests/unit/file-tree-node.spec.ts tests/unit/tab-strip.spec.ts tests/unit/editor-command-events.spec.ts tests/unit/app-shell.spec.ts`
Expected: PASS

- [ ] **Step 2: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 4: Commit verification-safe cleanup if needed**

```bash
git add src/components/ContextMenu.vue src/lib/context-menu.ts src/editor/EditorView.vue src/editor/editor-command-events.ts src/components/FileTreeNode.vue src/components/TabStrip.vue src/stores/documents.ts src/styles/app.css tests/unit/context-menu.spec.ts tests/unit/file-tree-node.spec.ts tests/unit/tab-strip.spec.ts tests/unit/editor-command-events.spec.ts tests/unit/app-shell.spec.ts
git commit -m "test: verify context menu feature"
```

---

## Self-Review

- Spec coverage: shared context menu, file tree migration, tab strip actions, editor menu, and `paragraph.table` all map to Tasks 1-5. Verification maps to Task 6.
- Placeholder scan: no `TODO`/`TBD` markers remain; each task includes file targets and runnable commands.
- Type consistency: `ContextMenuAction`, `closeOtherSessions`, and `paragraph.table` naming is consistent across tasks.
