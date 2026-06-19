# Sidebar Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change sidebar to default-hidden, auto-showing the file tree only when a folder workspace is opened.

**Architecture:** Two-store coordination: `ui.sidebarCollapsed` defaults to `true`; `folderWorkspace.setRootPath()` sets it to `false`. No persistence changes needed since the folder workspace store already resets on restart.

**Tech Stack:** Vue 3 + Pinia + Vitest

---

### Task 1: Change `sidebarCollapsed` default to `true`

**Files:**
- Modify: `src/stores/ui.ts:21`
- Modify: `tests/unit/ui-store.spec.ts`

- [ ] **Step 1: Change default value**

In `src/stores/ui.ts` line 21, change:

```typescript
sidebarCollapsed: true,
```

- [ ] **Step 2: Add test for default value**

In `tests/unit/ui-store.spec.ts`, add a test:

```typescript
it("defaults sidebar to collapsed (hidden)", () => {
  vi.stubGlobal("localStorage", undefined);
  setActivePinia(createPinia());
  const store = useUiStore();
  expect(store.sidebarCollapsed).toBe(true);
});
```

- [ ] **Step 3: Run ui-store tests**

```bash
pnpm vitest run tests/unit/ui-store.spec.ts
```

Expected: 2 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/stores/ui.ts tests/unit/ui-store.spec.ts
git commit -m "feat: default sidebar to collapsed (hidden)"
```

---

### Task 2: Auto-show sidebar when opening a folder

**Files:**
- Modify: `src/stores/folder-workspace.ts:47-53`
- Modify: `tests/unit/folder-workspace.spec.ts`

- [ ] **Step 1: Import ui store in folder-workspace store**

In `src/stores/folder-workspace.ts`, add import:

```typescript
import { useUiStore } from "@/stores/ui";
```

- [ ] **Step 2: Set sidebar visible in `setRootPath`**

In `src/stores/folder-workspace.ts`, modify `setRootPath` to auto-show sidebar:

```typescript
async setRootPath(root: string) {
  stopFolderWatch();
  this.rootPath = root;
  this.expandedPaths = [root];
  useUiStore().sidebarCollapsed = false;
  await this.refreshTree();
  await startFolderWatch(root, async () => {
    await this.refreshTree();
  });
},
```

- [ ] **Step 3: Add mock + test for auto-show behavior**

In `tests/unit/folder-workspace.spec.ts`, add `vi` to the vitest import and add a `vi.mock` before the `describe` block (required — `vi.mock` must be at module top level), then add a new test:

Update the import line (line 1):
```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
```

Add the mock before `describe` (after imports, before line 5):
```typescript
vi.mock("@/lib/workspace-service", () => ({
  listMarkdownTree: vi.fn(async () => ({
    name: "test",
    path: "/tmp/test",
    kind: "folder" as const,
    children: [],
  })),
  startFolderWatch: vi.fn(async () => {}),
  stopFolderWatch: vi.fn(),
}));
```

Add import for ui store (after the folder-workspace import):
```typescript
import { useUiStore } from "../../src/stores/ui";
```

Add the new test inside `describe`:
```typescript
it("shows sidebar when setRootPath is called", async () => {
  const folderStore = useFolderWorkspaceStore();
  const uiStore = useUiStore();

  expect(uiStore.sidebarCollapsed).toBe(true);

  await folderStore.setRootPath("/tmp/test");

  expect(uiStore.sidebarCollapsed).toBe(false);
  expect(folderStore.rootPath).toBe("/tmp/test");
});
```

- [ ] **Step 4: Run folder-workspace tests**

```bash
pnpm vitest run tests/unit/folder-workspace.spec.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stores/folder-workspace.ts tests/unit/folder-workspace.spec.ts
git commit -m "feat: auto-show sidebar when folder workspace is opened"
```

---

### Task 3: Verify app-shell behavior

**Files:**
- Modify: `tests/unit/app-shell.spec.ts`

- [ ] **Step 1: Add test for sidebar hidden by default**

The sidebar uses `v-show` so it's always in the DOM — it's just invisible. Add a test that verifies the sidebar-collapsed CSS class is applied when `sidebarCollapsed` is true.

In `tests/unit/app-shell.spec.ts`, add:

```typescript
it("hides sidebar by default (clean editor)", () => {
  const wrapper = mount(AppShell, {
    global: {
      plugins: [createPinia()],
    },
  });

  // Sidebar is in DOM (v-show) but the collapsed class is present
  expect(wrapper.find("[data-testid='sidebar']").exists()).toBe(true);
  expect(wrapper.find(".app-shell--sidebar-collapsed").exists()).toBe(true);
});
```

- [ ] **Step 2: Run app-shell tests**

```bash
pnpm vitest run tests/unit/app-shell.spec.ts
```

Expected: 18 tests PASS (17 existing + 1 new).

- [ ] **Step 3: Run full test suite**

```bash
pnpm test --run
```

Expected: All non-pre-existing-failure tests pass.

- [ ] **Step 4: Run typecheck**

```bash
pnpm typecheck
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add tests/unit/app-shell.spec.ts
git commit -m "test: verify sidebar hidden by default in app-shell"
```

---

### Verification Checklist

After all tasks complete:

- [ ] `pnpm typecheck` — no errors
- [ ] `pnpm test --run` — no new failures
- [ ] Manual smoke test: `pnpm tauri dev` — App opens with no sidebar
- [ ] Manual smoke test: Open folder → sidebar appears with file tree
- [ ] Manual smoke test: Cmd+Shift+L toggles sidebar manually
- [ ] Manual smoke test: After manual hide, open another folder → sidebar re-shows
