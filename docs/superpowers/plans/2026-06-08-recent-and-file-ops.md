# Recent List and File Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add removable and clearable `RECENT` file entries, and complete the user-facing file-operation surface for the file tree using the shared context-menu system.

**Architecture:** Extend the existing recent-file persistence pipeline end-to-end: Rust recent-file commands, frontend file-service wrappers, Pinia document-store actions, and `Sidebar.vue` UI controls. Keep file-tree operations on the existing shared `ContextMenu` path and focus this work on making recent-file actions first-class while regression-testing current file-tree actions.

**Tech Stack:** Vue 3 SFCs, Pinia, TypeScript, Tauri commands in Rust, Vitest, Vue Test Utils

**Spec:** `docs/superpowers/specs/2026-06-08-recent-and-file-ops-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `src-tauri/src/recent.rs` | Persist, remove, and clear recent file records |
| `src-tauri/src/main.rs` | Register new recent-file Tauri commands |
| `src/lib/file-service.ts` | Frontend wrappers for recent-file mutation |
| `src/stores/documents.ts` | Own recent-file mutations in app state |
| `src/components/Sidebar.vue` | `RECENT` UI actions and shared context menu integration |
| `tests/unit/sidebar.spec.ts` | Recent-list menu, remove, and clear-all behavior |
| `tests/unit/file-tree-node.spec.ts` | File-tree action wiring regressions |

### Task 1: Add backend commands for removing and clearing recent files

**Files:**
- Modify: `src-tauri/src/recent.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Write the failing Rust tests**

Add tests to `src-tauri/src/recent.rs`:

```rust
#[test]
fn removes_an_existing_recent_path() {
    let recent = vec!["a.md".into(), "b.md".into(), "c.md".into()];
    let next = remove_recent_path(recent, "b.md".into());
    assert_eq!(next, vec!["a.md", "c.md"]);
}

#[test]
fn removing_a_missing_path_leaves_recent_unchanged() {
    let recent = vec!["a.md".into(), "b.md".into()];
    let next = remove_recent_path(recent.clone(), "z.md".into());
    assert_eq!(next, recent);
}

#[test]
fn clears_all_recent_paths() {
    let recent = vec!["a.md".into(), "b.md".into()];
    let next = clear_recent_paths(recent);
    assert!(next.is_empty());
}
```

- [ ] **Step 2: Run Rust tests to verify they fail**

Run: `cargo test recent --manifest-path src-tauri/Cargo.toml`

Expected: FAIL because `remove_recent_path` / `clear_recent_paths` and the corresponding commands do not exist.

- [ ] **Step 3: Write the minimal Rust implementation**

Implement helpers and commands in `src-tauri/src/recent.rs`:

```rust
fn save_recent_files(app: &tauri::AppHandle, recent: &[String]) -> Result<(), String> {
    fs::write(
        recent_file_path(app)?,
        serde_json::to_string_pretty(recent).map_err(|err| err.to_string())?,
    )
    .map_err(|err| err.to_string())
}

pub fn remove_recent_path(recent: Vec<String>, path: String) -> Vec<String> {
    recent.into_iter().filter(|item| item != &path).collect()
}

pub fn clear_recent_paths(_recent: Vec<String>) -> Vec<String> {
    Vec::new()
}

#[tauri::command]
pub fn remove_recent_file(app: tauri::AppHandle, path: String) -> Result<Vec<String>, String> {
    let recent = load_recent_files(app.clone())?;
    let next = remove_recent_path(recent, path);
    save_recent_files(&app, &next)?;
    Ok(next)
}

#[tauri::command]
pub fn clear_recent_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let next = clear_recent_paths(load_recent_files(app.clone())?);
    save_recent_files(&app, &next)?;
    Ok(next)
}
```

Register commands in `src-tauri/src/main.rs`:

```rust
recent::load_recent_files,
recent::save_recent_file,
recent::remove_recent_file,
recent::clear_recent_files,
```

- [ ] **Step 4: Run Rust tests to verify they pass**

Run: `cargo test recent --manifest-path src-tauri/Cargo.toml`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/recent.rs src-tauri/src/main.rs
git commit -m "feat: add recent file removal commands"
```

### Task 2: Expose recent-file mutations through the frontend service and store

**Files:**
- Modify: `src/lib/file-service.ts`
- Modify: `src/stores/documents.ts`
- Test: `tests/unit/documents-recent.spec.ts`

- [ ] **Step 1: Write the failing store test**

Create `tests/unit/documents-recent.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDocumentsStore } from "@/stores/documents";

vi.mock("@/lib/file-service", () => ({
  loadRecentFiles: vi.fn(async () => []),
  saveRecentFile: vi.fn(async (path: string) => [path]),
  removeRecentFile: vi.fn(async () => ["b.md"]),
  clearRecentFiles: vi.fn(async () => []),
}));

describe("documents recent actions", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("removes one recent file without touching sessions", async () => {
    const store = useDocumentsStore();
    store.recentFiles = ["a.md", "b.md"];
    store.createNewDocument();

    await store.removeRecent("a.md");

    expect(store.recentFiles).toEqual(["b.md"]);
    expect(store.sessions).toHaveLength(1);
  });

  it("clears recent files without touching sessions", async () => {
    const store = useDocumentsStore();
    store.recentFiles = ["a.md", "b.md"];
    store.createNewDocument();

    await store.clearRecent();

    expect(store.recentFiles).toEqual([]);
    expect(store.sessions).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the store test to verify it fails**

Run: `pnpm exec vitest run tests/unit/documents-recent.spec.ts`

Expected: FAIL because `removeRecentFile` / `clearRecentFiles` wrappers and `documents` store actions do not exist.

- [ ] **Step 3: Write minimal frontend implementation**

Add service wrappers in `src/lib/file-service.ts`:

```ts
export async function removeRecentFile(path: string) {
  if (!isTauri()) {
    return [];
  }
  return invoke<string[]>("remove_recent_file", { path });
}

export async function clearRecentFiles() {
  if (!isTauri()) {
    return [];
  }
  return invoke<string[]>("clear_recent_files");
}
```

Wire store actions in `src/stores/documents.ts`:

```ts
import {
  clearRecentFiles,
  loadRecentFiles,
  pickMarkdownFile,
  pickSaveHtmlFile,
  pickSaveMarkdownFile,
  readMarkdownFile,
  removeRecentFile,
  saveRecentFile,
  writeMarkdownFile,
  writeTextFile,
} from "@/lib/file-service";

async removeRecent(path: string) {
  this.recentFiles = await removeRecentFile(path);
},

async clearRecent() {
  this.recentFiles = await clearRecentFiles();
},
```

- [ ] **Step 4: Run the store test to verify it passes**

Run: `pnpm exec vitest run tests/unit/documents-recent.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/file-service.ts src/stores/documents.ts tests/unit/documents-recent.spec.ts
git commit -m "feat: wire recent file removal in frontend state"
```

### Task 3: Add `RECENT` list context menu and clear action

**Files:**
- Modify: `src/components/Sidebar.vue`
- Test: `tests/unit/sidebar.spec.ts`
- Read for reference: `src/components/FileTreeNode.vue`

- [ ] **Step 1: Write the failing sidebar tests**

Create `tests/unit/sidebar.spec.ts`:

```ts
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import Sidebar from "@/components/Sidebar.vue";
import { useDocumentsStore } from "@/stores/documents";

describe("Sidebar recent actions", () => {
  it("opens a context menu for a recent file and removes it", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    documents.recentFiles = ["/tmp/a.md"];
    documents.removeRecent = vi.fn(async () => {});

    const wrapper = mount(Sidebar, { attachTo: document.body, global: { plugins: [pinia] } });
    const recent = wrapper.find(".nav-item");
    await recent.trigger("contextmenu", { clientX: 120, clientY: 80, button: 2 });
    await nextTick();

    const labels = Array.from(document.body.querySelectorAll(".context-menu__label")).map((node) =>
      node.textContent?.trim(),
    );
    expect(labels).toEqual(["Open", "Remove from Recent", "Reveal in Finder"]);

    const removeButton = Array.from(document.body.querySelectorAll(".context-menu__item"))
      .find((node) => node.textContent?.includes("Remove from Recent")) as HTMLButtonElement | undefined;
    removeButton?.click();
    await nextTick();

    expect(documents.removeRecent).toHaveBeenCalledWith("/tmp/a.md");
  });

  it("clears all recent files from the header action", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    documents.recentFiles = ["/tmp/a.md"];
    documents.clearRecent = vi.fn(async () => {});

    const wrapper = mount(Sidebar, { global: { plugins: [pinia] } });
    await wrapper.get("[data-testid='recent-clear']").trigger("click");

    expect(documents.clearRecent).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the sidebar test to verify it fails**

Run: `pnpm exec vitest run tests/unit/sidebar.spec.ts`

Expected: FAIL because `Sidebar.vue` has no recent-item context menu and no clear action.

- [ ] **Step 3: Write the minimal UI implementation**

Update `src/components/Sidebar.vue` to:

- import `ContextMenu` and `createContextMenuController`
- track the selected recent path for menu actions
- add a `Clear` header button only when `documents.recentFiles.length > 0`
- open a shared menu on right-click of a recent row

Core script additions:

```ts
import { computed, ref } from "vue";
import ContextMenu from "@/components/ContextMenu.vue";
import { createContextMenuController, type ContextMenuActionItem, type ContextMenuItem } from "@/lib/context-menu";
import { revealInFinder } from "@/lib/workspace-service";

const menu = createContextMenuController();
const selectedRecentPath = ref("");
const recentMenuItems = computed<ContextMenuItem[]>(() => [
  { type: "action", id: "open", label: "Open" },
  { type: "action", id: "remove", label: "Remove from Recent" },
  { type: "action", id: "reveal", label: "Reveal in Finder" },
]);

function openRecentMenu(event: MouseEvent, path: string) {
  selectedRecentPath.value = path;
  menu.openAt(event.clientX, event.clientY);
}

async function onRecentMenuSelect(item: ContextMenuActionItem) {
  const path = selectedRecentPath.value;
  menu.close("programmatic");
  if (!path) return;
  if (item.id === "open") await openRecent(path);
  if (item.id === "remove") await documents.removeRecent(path);
  if (item.id === "reveal") await revealInFinder(path);
}

async function clearRecent() {
  await documents.clearRecent();
}
```

Template additions:

```vue
<button
  v-if="documents.recentFiles.length > 0"
  data-testid="recent-clear"
  type="button"
  class="panel__action"
  @click="clearRecent"
>
  Clear
</button>
```

and on each recent row:

```vue
@contextmenu.prevent="openRecentMenu($event, path)"
```

plus a trailing `ContextMenu` instance.

- [ ] **Step 4: Run the sidebar test to verify it passes**

Run: `pnpm exec vitest run tests/unit/sidebar.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.vue tests/unit/sidebar.spec.ts
git commit -m "feat: add recent list management actions"
```

### Task 4: Lock in file-tree operation coverage

**Files:**
- Modify: `tests/unit/file-tree-node.spec.ts`
- Modify only if needed: `src/components/FileTreeNode.vue`

- [ ] **Step 1: Add explicit file-tree action regression tests**

Extend `tests/unit/file-tree-node.spec.ts` with coverage like:

```ts
it("shows the shared menu for files and runs rename", async () => {
  const wrapper = mountNode(fileNode);
  await wrapper.get(".file-tree__row--file").trigger("contextmenu", { clientX: 80, clientY: 90, button: 2 });
  await nextTick();

  const labels = Array.from(document.body.querySelectorAll(".context-menu__label")).map((node) =>
    node.textContent?.trim(),
  );
  expect(labels).toEqual(["Open", "Rename", "Delete", "Reveal in Finder"]);
});

it("shows the shared menu for folders and runs new file", async () => {
  const wrapper = mountNode(folderNode);
  await wrapper.get(".file-tree__row").trigger("contextmenu", { clientX: 80, clientY: 90, button: 2 });
  await nextTick();

  const labels = Array.from(document.body.querySelectorAll(".context-menu__label")).map((node) =>
    node.textContent?.trim(),
  );
  expect(labels).toEqual(["New File", "Reveal in Finder"]);
});
```

- [ ] **Step 2: Run the file-tree test to verify current behavior**

Run: `pnpm exec vitest run tests/unit/file-tree-node.spec.ts`

Expected: PASS if current implementation already satisfies the spec, or FAIL only where behavior drift exists.

- [ ] **Step 3: Patch `FileTreeNode.vue` only if a regression is exposed**

If tests reveal drift, keep the fix minimal and confined to menu wiring or action ordering. Do not add new file-tree actions beyond:

```ts
[
  { type: "action", id: "open", label: "Open" },
  { type: "action", id: "rename", label: "Rename" },
  { type: "action", id: "delete", label: "Delete" },
  { type: "action", id: "reveal", label: "Reveal in Finder" },
]
```

and folder:

```ts
[
  { type: "action", id: "new-file", label: "New File" },
  { type: "action", id: "reveal", label: "Reveal in Finder" },
]
```

- [ ] **Step 4: Re-run the file-tree test**

Run: `pnpm exec vitest run tests/unit/file-tree-node.spec.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/FileTreeNode.vue tests/unit/file-tree-node.spec.ts
git commit -m "test: lock file tree operations to spec"
```

### Task 5: Final verification

**Files:**
- Modify: none

- [ ] **Step 1: Run focused frontend verification**

Run:

```bash
pnpm exec vitest run tests/unit/documents-recent.spec.ts
pnpm exec vitest run tests/unit/sidebar.spec.ts
pnpm exec vitest run tests/unit/file-tree-node.spec.ts
```

Expected: PASS

- [ ] **Step 2: Run focused Rust verification**

Run:

```bash
cargo test recent --manifest-path src-tauri/Cargo.toml
```

Expected: PASS

- [ ] **Step 3: Review final diff scope**

Run:

```bash
git diff -- src-tauri/src/recent.rs src-tauri/src/main.rs src/lib/file-service.ts src/stores/documents.ts src/components/Sidebar.vue tests/unit/documents-recent.spec.ts tests/unit/sidebar.spec.ts tests/unit/file-tree-node.spec.ts
```

Expected: only recent-file mutation and file-tree regression coverage changes.

- [ ] **Step 4: Commit any final fixups**

```bash
git add src-tauri/src/recent.rs src-tauri/src/main.rs src/lib/file-service.ts src/stores/documents.ts src/components/Sidebar.vue tests/unit/documents-recent.spec.ts tests/unit/sidebar.spec.ts tests/unit/file-tree-node.spec.ts
git commit -m "feat: complete recent list and file operations"
```

## Self-review

- Spec coverage: Task 1 covers backend recent-file mutation, Task 2 covers frontend service/store wiring, Task 3 covers `RECENT` UI actions, Task 4 covers file-tree operation entry points, Task 5 covers verification.
- Placeholder scan: all tasks use exact file paths, concrete code, and explicit commands.
- Type consistency: command names and store methods are consistently named `removeRecentFile`, `clearRecentFiles`, `removeRecent`, and `clearRecent`.
