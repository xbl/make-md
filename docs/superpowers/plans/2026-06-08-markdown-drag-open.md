# Markdown Drag Open Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users drag one or more Markdown files onto the app window and open them as document tabs.

**Architecture:** Add a window-level drag/drop handler in `AppShell` and reuse `documents.openFile(path)` as the only open path. Keep the feature frontend-only, with a lightweight valid-drag overlay and strict `.md` / `.markdown` filtering so it stays isolated from internal file-tree drag/drop behavior.

**Tech Stack:** Vue 3 SFCs, Pinia, TypeScript, Vue Test Utils, Vitest

---

## File Structure

- Modify: `src/layout/AppShell.vue`
  - Add shell-level drag/drop state, file filtering helpers, drag overlay, and markdown-file drop handling.
- Modify: `src/styles/app.css`
  - Add the shell drag-overlay styles.
- Test: `tests/unit/app-shell.spec.ts`
  - Add focused drag/drop tests for valid markdown files, ignored non-markdown files, and overlay visibility.

### Task 1: Add Markdown Drop Tests in AppShell

**Files:**
- Test: `tests/unit/app-shell.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
it("shows a drag overlay for markdown files and hides it on drag leave", async () => {
  const wrapper = mount(AppShell, {
    attachTo: document.body,
    global: {
      plugins: [createPinia()],
    },
  });

  await wrapper.get(".app-shell").trigger("dragenter", {
    dataTransfer: {
      files: [{ path: "/tmp/note.md", name: "note.md" }],
      items: [{ kind: "file", type: "text/markdown" }],
      types: ["Files"],
    },
  });
  await nextTick();

  expect(wrapper.find(".app-shell__drop-overlay").exists()).toBe(true);

  await wrapper.get(".app-shell").trigger("dragleave");
  await nextTick();

  expect(wrapper.find(".app-shell__drop-overlay").exists()).toBe(false);
});

it("opens only markdown files from a mixed drop", async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const documents = useDocumentsStore();
  const openSpy = vi.spyOn(documents, "openFile").mockResolvedValue(null as never);

  const wrapper = mount(AppShell, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
    },
  });

  const preventDefault = vi.fn();
  await wrapper.get(".app-shell").trigger("drop", {
    preventDefault,
    dataTransfer: {
      files: [
        { path: "/tmp/one.md", name: "one.md" },
        { path: "/tmp/two.txt", name: "two.txt" },
        { path: "/tmp/three.markdown", name: "three.markdown" },
      ],
      items: [
        { kind: "file", type: "text/markdown" },
        { kind: "file", type: "text/plain" },
        { kind: "file", type: "text/markdown" },
      ],
      types: ["Files"],
    },
  });

  expect(preventDefault).toHaveBeenCalled();
  expect(openSpy).toHaveBeenCalledTimes(2);
  expect(openSpy).toHaveBeenNthCalledWith(1, "/tmp/one.md");
  expect(openSpy).toHaveBeenNthCalledWith(2, "/tmp/three.markdown");
});

it("ignores drops without markdown files", async () => {
  const pinia = createPinia();
  setActivePinia(pinia);
  const documents = useDocumentsStore();
  const openSpy = vi.spyOn(documents, "openFile").mockResolvedValue(null as never);

  const wrapper = mount(AppShell, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
    },
  });

  await wrapper.get(".app-shell").trigger("drop", {
    dataTransfer: {
      files: [{ path: "/tmp/image.png", name: "image.png" }],
      items: [{ kind: "file", type: "image/png" }],
      types: ["Files"],
    },
  });

  expect(openSpy).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run tests/unit/app-shell.spec.ts`
Expected: FAIL because the shell has no drag-open overlay or file-drop handling yet.

- [ ] **Step 3: Write minimal implementation**

```ts
const dragActive = ref(false);
const dragDepth = ref(0);

function isMarkdownFileName(name: string) {
  return /\.(md|markdown)$/i.test(name);
}

function markdownDropPaths(event: DragEvent) {
  return Array.from(event.dataTransfer?.files ?? [])
    .map((file) => ("path" in file ? (file as File & { path?: string }).path ?? "" : ""))
    .filter((path) => isMarkdownFileName(path));
}

function hasMarkdownDrop(event: DragEvent) {
  return markdownDropPaths(event).length > 0;
}

function handleDragEnter(event: DragEvent) {
  if (!hasMarkdownDrop(event)) {
    return;
  }
  dragDepth.value += 1;
  dragActive.value = true;
}

function handleDragOver(event: DragEvent) {
  if (!hasMarkdownDrop(event)) {
    return;
  }
  event.preventDefault();
  dragActive.value = true;
}

function handleDragLeave() {
  dragDepth.value = Math.max(0, dragDepth.value - 1);
  if (dragDepth.value === 0) {
    dragActive.value = false;
  }
}

async function handleDrop(event: DragEvent) {
  const paths = markdownDropPaths(event);
  dragDepth.value = 0;
  dragActive.value = false;
  if (paths.length === 0) {
    return;
  }

  event.preventDefault();
  for (const path of paths) {
    try {
      await documents.openFile(path);
    } catch {
      // Keep opening remaining markdown files.
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run tests/unit/app-shell.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/layout/AppShell.vue tests/unit/app-shell.spec.ts src/styles/app.css
git commit -m "feat: open markdown files by drag and drop"
```

### Task 2: Add Visual Overlay Styling and Final Regression Pass

**Files:**
- Modify: `src/styles/app.css`
- Test: `tests/unit/app-shell.spec.ts`

- [ ] **Step 1: Add the shell overlay styles**

```css
.app-shell__drop-overlay {
  position: fixed;
  inset: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--accent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  pointer-events: none;
  z-index: 110;
}
```

- [ ] **Step 2: Ensure the shell template renders the overlay only during valid drags**

```vue
<div
  class="app-shell"
  @dragenter="handleDragEnter"
  @dragover="handleDragOver"
  @dragleave="handleDragLeave"
  @drop="handleDrop"
>
  <div v-if="dragActive" class="app-shell__drop-overlay">
    Drop Markdown files to open
  </div>
</div>
```

- [ ] **Step 3: Run the focused regression suite**

Run: `pnpm exec vitest run tests/unit/app-shell.spec.ts tests/unit/context-menu.spec.ts tests/unit/file-tree-node.spec.ts tests/unit/tab-strip.spec.ts tests/unit/editor-command-events.spec.ts`
Expected: PASS

- [ ] **Step 4: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `pnpm lint`
Expected: PASS

---

## Self-Review

- Spec coverage: window-level drag/drop handling, markdown-only filtering, multi-file open, overlay visibility, and ignored non-markdown drops are all covered by Tasks 1-2.
- Placeholder scan: no `TODO`/`TBD` markers remain; each step includes concrete files and commands.
- Type consistency: drag handlers are consistently defined on `AppShell`, file opening always goes through `documents.openFile(path)`, and the overlay class name is consistent across template, test, and CSS.
