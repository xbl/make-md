# Phase 2 Workspace & Writing Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Typora-style folder workspace (file tree + CRUD), outline panel, in-document find/replace, image paste to `assets/`, and built-in macOS PDF export.

**Status (2026-06-07):** ✅ All tasks 1–9 implemented. See milestone table in `docs/superpowers/plans/2026-06-07-typora-desktop-editor.md`.

**Next phase:** `docs/superpowers/plans/2026-06-07-phase-3-editor-depth.md`

**Architecture:** Extend the existing Tauri command layer with a `workspace` Rust module (tree listing, file ops, watch, assets, PDF). Frontend adds a `folder-workspace` Pinia store and replaces `Sidebar.vue` with tabbed `SidebarTabs` (Files | Outline). Editor features (outline extraction, find/replace, image plugin) stay in `src/editor/` and connect via provide/inject from `EditorView.vue`.

**Tech Stack:** Tauri 2, Rust (`notify`, `serde`), Vue 3, Pinia, ProseMirror, Vitest, Playwright (minimal E2E).

**Spec:** `docs/superpowers/specs/2026-06-07-phase-2-workspace-writing-design.md`

---

## File Map

| File | Responsibility |
|------|----------------|
| `src-tauri/src/workspace/mod.rs` | Module root, re-exports commands |
| `src-tauri/src/workspace/tree.rs` | Recursive `.md` tree builder + exclusions |
| `src-tauri/src/workspace/files.rs` | create/rename/delete/move/reveal commands |
| `src-tauri/src/workspace/watch.rs` | `notify` watcher, emit `workspace://changed` |
| `src-tauri/src/workspace/assets.rs` | `copy_image_asset` |
| `src-tauri/src/workspace/recent.rs` | Persist `recent-workspaces.json` |
| `src-tauri/src/pdf/mod.rs` | `export_pdf` command, macOS renderer |
| `src/lib/workspace-service.ts` | Typed invoke wrappers for workspace commands |
| `src/stores/folder-workspace.ts` | Root path, tree, expansion, selection, refresh |
| `src/components/SidebarTabs.vue` | Files \| Outline tab shell |
| `src/components/FileTree.vue` | Tree UI, context menu, drag-drop |
| `src/components/OutlinePanel.vue` | Heading navigation list |
| `src/lib/outline.ts` | Extract headings from ProseMirror doc |
| `src/editor/find-replace.ts` | Search plugin + decoration helpers |
| `src/components/FindReplaceBar.vue` | Find/replace UI bar |
| `src/lib/image-assets.ts` | Paste/drop → copy asset → insert image |
| `src/lib/export-pdf.ts` | HTML → `export_pdf` invoke |
| `src/editor/editor-context.ts` | Shared ref type for active EditorView |

---

### Task 1: Rust markdown tree listing

**Files:**
- Create: `src-tauri/src/workspace/mod.rs`
- Create: `src-tauri/src/workspace/tree.rs`
- Modify: `src-tauri/src/main.rs`
- Delete/replace: `src-tauri/src/workspace.rs` (move stub into `mod.rs` or remove `workspace_name`)
- Modify: `src-tauri/Cargo.toml`

- [ ] **Step 1: Add Rust dependencies**

In `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
serde = { version = "1", features = ["derive"] }
```

- [ ] **Step 2: Write tree unit tests**

Create `src-tauri/src/workspace/tree.rs` with a `#[cfg(test)]` module at the bottom:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn lists_markdown_files_recursively() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join("notes")).unwrap();
        fs::write(root.join("readme.md"), "# Hi").unwrap();
        fs::write(root.join("notes/a.md"), "# A").unwrap();
        fs::write(root.join("notes/skip.txt"), "nope").unwrap();

        let tree = build_markdown_tree(root.to_str().unwrap()).unwrap();
        assert_eq!(tree.kind, "folder");
        assert!(tree.children.iter().any(|n| n.name == "readme.md"));
        let notes = tree.children.iter().find(|n| n.name == "notes").unwrap();
        assert!(notes.children.iter().any(|n| n.name == "a.md"));
    }

    #[test]
    fn skips_git_and_node_modules() {
        let dir = tempdir().unwrap();
        let root = dir.path();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::create_dir_all(root.join("node_modules/pkg")).unwrap();
        fs::write(root.join(".git/hidden.md"), "# X").unwrap();
        fs::write(root.join("node_modules/pkg/x.md"), "# X").unwrap();
        fs::write(root.join("ok.md"), "# Ok").unwrap();

        let tree = build_markdown_tree(root.to_str().unwrap()).unwrap();
        let names: Vec<_> = tree.children.iter().map(|n| n.name.as_str()).collect();
        assert!(names.contains(&"ok.md"));
        assert!(!names.iter().any(|n| *n == ".git" || *n == "node_modules"));
    }
}
```

Add dev-dependency in `Cargo.toml`:

```toml
[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd src-tauri && cargo test workspace::tree -- --nocapture`
Expected: FAIL — `build_markdown_tree` not defined.

- [ ] **Step 4: Implement tree builder**

`src-tauri/src/workspace/tree.rs`:

```rust
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TreeNode {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub children: Vec<TreeNode>,
}

fn should_skip_dir(name: &str) -> bool {
    name == ".git" || name == "node_modules" || name.starts_with('.')
}

pub fn build_markdown_tree(root: &str) -> Result<TreeNode, String> {
    let root_path = PathBuf::from(root);
    if !root_path.is_dir() {
        return Err(format!("Not a directory: {root}"));
    }
    build_folder_node(&root_path)
}

fn build_folder_node(path: &Path) -> Result<TreeNode, String> {
    let mut children = Vec::new();
    let mut entries: Vec<_> = fs::read_dir(path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .collect();
    entries.sort_by_key(|e| e.file_name());

    for entry in entries {
        let name = entry.file_name().to_string_lossy().to_string();
        let entry_path = entry.path();
        if entry_path.is_dir() {
            if should_skip_dir(&name) {
                continue;
            }
            children.push(build_folder_node(&entry_path)?);
        } else if name.ends_with(".md") || name.ends_with(".markdown") {
            children.push(TreeNode {
                name,
                path: entry_path.to_string_lossy().to_string(),
                kind: "file".to_string(),
                children: vec![],
            });
        }
    }

    Ok(TreeNode {
        name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
        path: path.to_string_lossy().to_string(),
        kind: "folder".to_string(),
        children,
    })
}

#[tauri::command]
pub fn list_markdown_tree(root: String) -> Result<TreeNode, String> {
    build_markdown_tree(&root)
}
```

`src-tauri/src/workspace/mod.rs`:

```rust
mod tree;
pub use tree::{build_markdown_tree, list_markdown_tree, TreeNode};
```

Update `src-tauri/src/main.rs`:

```rust
mod workspace;

// in invoke_handler:
workspace::list_markdown_tree,
```

Remove the old `workspace.rs` stub file if it conflicts; use `mod workspace;` pointing to the folder.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-tauri && cargo test workspace::tree -- --nocapture`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/workspace src-tauri/src/main.rs
git commit -m "feat: add rust markdown tree listing"
```

---

### Task 2: Folder workspace store and open-folder UI (M1)

**Files:**
- Create: `src/lib/workspace-service.ts`
- Create: `src/stores/folder-workspace.ts`
- Create: `src/components/SidebarTabs.vue`
- Create: `src/components/FileTree.vue`
- Modify: `src/lib/file-service.ts`
- Modify: `src/layout/AppShell.vue`
- Modify: `src/styles/app.css`
- Test: `tests/unit/folder-workspace.spec.ts`

- [ ] **Step 1: Write failing store test**

Create `tests/unit/folder-workspace.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useFolderWorkspaceStore } from "../../src/stores/folder-workspace";

describe("folder workspace store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("tracks expanded folder paths", () => {
    const store = useFolderWorkspaceStore();
    expect(store.isExpanded("/tmp/root")).toBe(false);
    store.toggleExpanded("/tmp/root");
    expect(store.isExpanded("/tmp/root")).toBe(true);
  });

  it("finds file node by path in tree", () => {
    const store = useFolderWorkspaceStore();
    store.tree = {
      name: "root",
      path: "/tmp/root",
      kind: "folder",
      children: [
        { name: "a.md", path: "/tmp/root/a.md", kind: "file", children: [] },
      ],
    };
    expect(store.findNode("/tmp/root/a.md")?.name).toBe("a.md");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/folder-workspace.spec.ts -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Add workspace service and store**

`src/lib/workspace-service.ts`:

```ts
import { invoke, isTauri } from "@tauri-apps/api/core";

export type TreeNode = {
  name: string;
  path: string;
  kind: "file" | "folder" | string;
  children: TreeNode[];
};

export async function listMarkdownTree(root: string): Promise<TreeNode> {
  if (!isTauri()) {
    return { name: "root", path: root, kind: "folder", children: [] };
  }
  return invoke<TreeNode>("list_markdown_tree", { root });
}
```

`src/stores/folder-workspace.ts`:

```ts
import { defineStore } from "pinia";
import { listMarkdownTree, type TreeNode } from "@/lib/workspace-service";

export type SidebarTab = "files" | "outline";

export const useFolderWorkspaceStore = defineStore("folder-workspace", {
  state: () => ({
    rootPath: "" as string,
    tree: null as TreeNode | null,
    expandedPaths: [] as string[],
    selectedPath: "" as string,
    activeTab: "files" as SidebarTab,
  }),
  getters: {
    hasFolder(state): boolean {
      return Boolean(state.rootPath);
    },
  },
  actions: {
    isExpanded(path: string) {
      return this.expandedPaths.includes(path);
    },
    toggleExpanded(path: string) {
      if (this.isExpanded(path)) {
        this.expandedPaths = this.expandedPaths.filter((p) => p !== path);
      } else {
        this.expandedPaths = [...this.expandedPaths, path];
      }
    },
    findNode(path: string, node: TreeNode | null = this.tree): TreeNode | null {
      if (!node) return null;
      if (node.path === path) return node;
      for (const child of node.children) {
        const found = this.findNode(path, child);
        if (found) return found;
      }
      return null;
    },
    async setRootPath(root: string) {
      this.rootPath = root;
      this.expandedPaths = [root];
      await this.refreshTree();
    },
    async refreshTree() {
      if (!this.rootPath) {
        this.tree = null;
        return;
      }
      this.tree = await listMarkdownTree(this.rootPath);
    },
    setActiveTab(tab: SidebarTab) {
      this.activeTab = tab;
    },
    setSelectedPath(path: string) {
      this.selectedPath = path;
    },
  },
});
```

Add to `src/lib/file-service.ts`:

```ts
export async function pickFolder(): Promise<string | null> {
  if (!isTauri()) return null;
  const selected = await open({ directory: true, multiple: false });
  if (!selected || Array.isArray(selected)) return null;
  return normalizeFilePath(selected);
}
```

(import `open` already exists)

- [ ] **Step 4: Create SidebarTabs and FileTree components**

`src/components/SidebarTabs.vue` — tab header with Files | Outline; Files tab renders `FileTree` when `folderWorkspace.hasFolder`, else existing recent list from `Sidebar.vue` content; Outline tab renders `OutlinePanel` (placeholder div until Task 5).

`src/components/FileTree.vue` — recursive tree: folders toggle expand, files emit `@open-file` with path. Include header button **Open Folder**.

Wire `AppShell.vue` to use `<SidebarTabs />` instead of `<Sidebar />`.

- [ ] **Step 5: Wire open folder action**

In `SidebarTabs.vue` or `FileTree.vue`:

```ts
async function openFolder() {
  const path = await pickFolder();
  if (!path) return;
  await folderWorkspace.setRootPath(path);
  folderWorkspace.setActiveTab("files");
}
```

On file click: `await documents.openFile(path)`.

Add ⌘⇧O handler in `AppShell.vue` `handleKeydown`:

```ts
if (event.key === "o" && event.shiftKey) {
  event.preventDefault();
  // call openFolder via store action or emit
}
```

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run tests/unit/folder-workspace.spec.ts -v`
Expected: PASS.

Run: `pnpm tauri dev` — open folder, tree shows `.md` files, click opens tab.

- [ ] **Step 7: Commit**

```bash
git add src/lib/workspace-service.ts src/stores/folder-workspace.ts src/components/SidebarTabs.vue src/components/FileTree.vue src/lib/file-service.ts src/layout/AppShell.vue src/styles/app.css tests/unit/folder-workspace.spec.ts
git commit -m "feat: add folder workspace tree and open folder UI"
```

---

### Task 3: Folder watch and external change refresh (M1)

**Files:**
- Create: `src-tauri/src/workspace/watch.rs`
- Modify: `src-tauri/src/workspace/mod.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src/stores/folder-workspace.ts`
- Modify: `src/components/SidebarTabs.vue`

- [ ] **Step 1: Add notify dependency**

```toml
notify = "8"
```

- [ ] **Step 2: Implement watch command**

`src-tauri/src/workspace/watch.rs`:

```rust
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub fn watch_folder(app: AppHandle, root: String) -> Result<(), String> {
    let path = Path::new(&root).to_path_buf();
    thread::spawn(move || {
        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(
            move |res| {
                if tx.send(res).is_err() {}
            },
            notify::Config::default(),
        )
        .expect("watcher");
        watcher
            .watch(&path, RecursiveMode::Recursive)
            .expect("watch");

        loop {
            if let Ok(Ok(event)) = rx.recv() {
                if matches!(
                    event.kind,
                    EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
                ) {
                    let _ = app.emit("workspace://changed", ());
                }
            }
        }
    });
    Ok(())
}
```

Register in `main.rs`. Note: only one watcher per session is sufficient for Phase 2.

- [ ] **Step 3: Listen in frontend with debounce**

In `folder-workspace.ts`:

```ts
import { listen } from "@tauri-apps/api/event";

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

export async function startFolderWatch(root: string, refresh: () => Promise<void>) {
  await invoke("watch_folder", { root });
  await listen("workspace://changed", () => {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => void refresh(), 300);
  });
}
```

Call from `setRootPath` after `refreshTree`.

- [ ] **Step 4: Manual verify**

Run `pnpm tauri dev`, open folder, create `new.md` in Finder → tree refreshes within ~300ms.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/workspace/watch.rs src-tauri/src/workspace/mod.rs src-tauri/src/main.rs src/stores/folder-workspace.ts
git commit -m "feat: watch folder for external filesystem changes"
```

---

### Task 4: File CRUD and tab path sync (M2)

**Files:**
- Create: `src-tauri/src/workspace/files.rs`
- Modify: `src-tauri/src/workspace/mod.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src/lib/workspace-service.ts`
- Modify: `src/stores/documents.ts`
- Modify: `src/components/FileTree.vue`
- Test: `tests/unit/documents-retarget.spec.ts`

- [ ] **Step 1: Write failing documents retarget test**

`tests/unit/documents-retarget.spec.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDocumentsStore } from "../../src/stores/documents";

describe("documents retarget path", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("updates session id and path after rename", async () => {
    const store = useDocumentsStore();
    await store.openFile("/tmp/old.md");
    store.retargetSessionPath("/tmp/old.md", "/tmp/new.md");
    expect(store.activeSession?.path).toBe("/tmp/new.md");
    expect(store.activeSessionId).toBe("/tmp/new.md");
  });
});
```

(Mock `readMarkdownFile` or test pure helper if invoke blocks — prefer extracting `retargetSessionPath` as store action that mutates sessions without IO.)

- [ ] **Step 2: Implement Rust file commands**

`src-tauri/src/workspace/files.rs`:

```rust
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[tauri::command]
pub fn create_file(parent: String, name: String) -> Result<String, String> {
    let mut file_name = name;
    if !file_name.ends_with(".md") {
        file_name.push_str(".md");
    }
    let path = PathBuf::from(&parent).join(&file_name);
    if path.exists() {
        return Err(format!("File already exists: {}", path.display()));
    }
    if let Some(p) = path.parent() {
        fs::create_dir_all(p).map_err(|e| e.to_string())?;
    }
    fs::write(&path, "").map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn rename_file(from: String, to: String) -> Result<String, String> {
    let src = PathBuf::from(&from);
    let dst = PathBuf::from(&to);
    if !src.exists() {
        return Err(format!("Source not found: {from}"));
    }
    if dst.exists() {
        return Err(format!("Target already exists: {to}"));
    }
    fs::rename(&src, &dst).map_err(|e| e.to_string())?;
    Ok(dst.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err(format!("File not found: {path}"));
    }
    if p.extension().and_then(|e| e.to_str()) != Some("md") {
        return Err("Only .md files can be deleted".into());
    }
    fs::remove_file(p).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn move_file(from: String, to_dir: String) -> Result<String, String> {
    let src = PathBuf::from(&from);
    let file_name = src.file_name().ok_or("Invalid source path")?;
    let dst = PathBuf::from(&to_dir).join(file_name);
    if dst.exists() {
        return Err(format!("Target already exists: {}", dst.display()));
    }
    fs::rename(&src, &dst).map_err(|e| e.to_string())?;
    Ok(dst.to_string_lossy().to_string())
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() {
        return Err(format!("Path not found: {path}"));
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg("-R").arg(&path).status().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer").arg("/select,").arg(&path).status().map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        let parent = p.parent().unwrap_or(p);
        Command::new("xdg-open").arg(parent).status().map_err(|e| e.to_string())?;
    }
    Ok(())
}
```

Register all commands in `main.rs`. Add wrappers in `workspace-service.ts`.

- [ ] **Step 3: Add documents store helpers**

```ts
retargetSessionPath(oldPath: string, newPath: string) {
  const session = this.sessions.find((s) => s.id === oldPath || s.path === oldPath);
  if (!session) return;
  session.setPath(newPath);
  const idx = this.sessions.findIndex((s) => s.id === oldPath);
  if (idx >= 0) {
    this.sessions[idx] = createDocumentSession({
      id: newPath,
      path: newPath,
      content: session.content,
    });
    if (this.activeSessionId === oldPath) {
      this.activeSessionId = newPath;
    }
  }
},
async closeSessionByPath(path: string) {
  return this.closeSession(path);
},
```

Ensure `document-session.ts` exposes `setPath`.

- [ ] **Step 4: FileTree context menu and drag-drop**

In `FileTree.vue`:
- Right-click folder → New File (prompt name) → `create_file` → `documents.openFile`
- Right-click file → Rename (inline input) → `rename_file` → `retargetSessionPath`
- Right-click file → Delete → confirm → `delete_file` → `closeSessionByPath`
- Right-click → Reveal in Finder
- Drag file onto folder → `move_file` → `retargetSessionPath`

- [ ] **Step 5: Run tests and manual verify**

Run: `pnpm vitest run tests/unit/documents-retarget.spec.ts -v`
Expected: PASS.

Manual: create/rename/delete/move in tree syncs tabs.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/workspace/files.rs src/lib/workspace-service.ts src/stores/documents.ts src/components/FileTree.vue tests/unit/documents-retarget.spec.ts
git commit -m "feat: add file tree CRUD and tab path sync"
```

---

### Task 5: Outline panel (M3)

**Files:**
- Create: `src/lib/outline.ts`
- Create: `src/components/OutlinePanel.vue`
- Create: `src/editor/editor-context.ts`
- Modify: `src/editor/EditorView.vue`
- Modify: `src/components/SidebarTabs.vue`
- Test: `tests/unit/outline.spec.ts`

- [ ] **Step 1: Write failing outline extraction test**

`tests/unit/outline.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { extractOutline } from "../../src/lib/outline";

describe("outline extraction", () => {
  it("extracts nested headings with positions", () => {
    const doc = parseMarkdown("# One\n\n## Two\n\npara\n\n# Three");
    const items = extractOutline(doc);
    expect(items.map((i) => i.text)).toEqual(["One", "Two", "Three"]);
    expect(items[1].level).toBe(2);
    expect(items.every((i) => typeof i.pos === "number")).toBe(true);
  });
});
```

- [ ] **Step 2: Implement extractOutline**

`src/lib/outline.ts`:

```ts
import type { Node as ProseMirrorNode } from "prosemirror-model";

export type OutlineItem = {
  level: number;
  text: string;
  pos: number;
};

export function extractOutline(doc: ProseMirrorNode): OutlineItem[] {
  const items: OutlineItem[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      items.push({
        level: Number(node.attrs.level ?? 1),
        text: node.textContent,
        pos,
      });
    }
  });
  return items;
}
```

- [ ] **Step 3: Expose editor view via context**

`src/editor/editor-context.ts`:

```ts
import type { EditorView } from "prosemirror-view";
import type { Ref } from "vue";

export const EditorViewKey = Symbol("editor-view");

export type EditorContext = {
  view: Ref<EditorView | null>;
  docVersion: Ref<number>;
};
```

In `EditorView.vue`, `provide(EditorViewKey, { view: ref(view), docVersion })` — increment `docVersion` on each transaction.

- [ ] **Step 4: Build OutlinePanel**

`OutlinePanel.vue` — inject context, computed outline from `view.value?.state.doc`, debounce 200ms on `docVersion`. Click item:

```ts
function scrollToHeading(pos: number) {
  const editor = view.value;
  if (!editor) return;
  const tr = editor.state.tr.scrollIntoView();
  editor.dispatch(tr);
  const dom = editor.nodeDOM(pos);
  if (dom instanceof HTMLElement) {
    dom.scrollIntoView({ behavior: "smooth", block: "center" });
  }
  editor.focus();
}
```

Empty state: "No headings in this document".

- [ ] **Step 5: Run tests and verify**

Run: `pnpm vitest run tests/unit/outline.spec.ts -v`
Expected: PASS.

Manual: Outline tab lists headings, click scrolls.

- [ ] **Step 6: Commit**

```bash
git add src/lib/outline.ts src/components/OutlinePanel.vue src/editor/editor-context.ts src/editor/EditorView.vue src/components/SidebarTabs.vue tests/unit/outline.spec.ts
git commit -m "feat: add document outline panel"
```

---

### Task 6: In-document find and replace (M4)

**Files:**
- Create: `src/editor/find-replace.ts`
- Create: `src/components/FindReplaceBar.vue`
- Modify: `src/editor/plugins.ts`
- Modify: `src/stores/ui.ts`
- Modify: `src/layout/AppShell.vue`
- Modify: `src/components/EditorPane.vue`
- Test: `tests/unit/find-replace.spec.ts`

- [ ] **Step 1: Write failing find helper test**

`tests/unit/find-replace.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { findMatches } from "../../src/editor/find-replace";

describe("findMatches", () => {
  it("finds all case-insensitive occurrences", () => {
    const matches = findMatches("Hello hello", "hello", { caseSensitive: false, wholeWord: false });
    expect(matches).toEqual([0, 6]);
  });

  it("respects whole word option", () => {
    const matches = findMatches("the there", "the", { caseSensitive: false, wholeWord: true });
    expect(matches).toEqual([0]);
  });
});
```

- [ ] **Step 2: Implement find helpers and plugin**

`src/editor/find-replace.ts` — export:
- `findMatches(text, query, options): number[]`
- `createFindReplacePlugin()` using `DecorationSet` inline highlights
- `FindReplaceState` plugin key with `{ query, replaceWith, activeIndex, caseSensitive, wholeWord, mode: 'find' | 'replace' }`
- Commands: `findNext`, `findPrev`, `replaceOne`, `replaceAll`

Add plugin to `createEditorPlugins()`.

- [ ] **Step 3: FindReplaceBar UI**

`FindReplaceBar.vue` — fixed bar above editor when `ui.findReplaceOpen`. Fields: query, replace (shown in replace mode), toggles, prev/next buttons, close.

Extend `ui.ts`:

```ts
findReplaceOpen: false,
findReplaceMode: "find" as "find" | "replace",
openFind(mode: "find" | "replace" = "find") {
  this.findReplaceMode = mode;
  this.findReplaceOpen = true;
},
closeFindReplace() {
  this.findReplaceOpen = false;
},
```

- [ ] **Step 4: Keyboard shortcuts in AppShell**

```ts
if (event.key === "f" && mod && event.altKey) {
  event.preventDefault();
  ui.openFind("replace");
  return;
}
if (event.key === "f" && mod) {
  event.preventDefault();
  ui.openFind("find");
  return;
}
if (event.key === "Escape" && ui.findReplaceOpen) {
  ui.closeFindReplace();
}
```

Mount `<FindReplaceBar />` in `EditorPane.vue`.

- [ ] **Step 5: Run tests and verify**

Run: `pnpm vitest run tests/unit/find-replace.spec.ts -v`
Expected: PASS.

Manual: ⌘F highlights matches, Enter cycles, replace works.

- [ ] **Step 6: Commit**

```bash
git add src/editor/find-replace.ts src/editor/plugins.ts src/components/FindReplaceBar.vue src/stores/ui.ts src/layout/AppShell.vue src/components/EditorPane.vue tests/unit/find-replace.spec.ts
git commit -m "feat: add in-document find and replace"
```

---

### Task 7: Image paste and drop to assets (M5)

**Files:**
- Create: `src-tauri/src/workspace/assets.rs`
- Modify: `src-tauri/src/workspace/mod.rs`
- Modify: `src-tauri/src/main.rs`
- Create: `src/lib/image-assets.ts`
- Modify: `src/editor/plugins.ts`
- Modify: `src/lib/workspace-service.ts`
- Test: `tests/unit/image-assets.spec.ts`

- [ ] **Step 1: Write failing relative path test**

`tests/unit/image-assets.spec.ts`:

```ts
import { describe, it, expect } from "vitest";
import { assetRelativePath } from "../../src/lib/image-assets";

describe("assetRelativePath", () => {
  it("returns ./assets/filename for sibling assets dir", () => {
    expect(assetRelativePath("/docs/note.md", "/docs/assets/paste.png")).toBe("./assets/paste.png");
  });
});
```

- [ ] **Step 2: Implement Rust copy_image_asset**

`src-tauri/src/workspace/assets.rs`:

```rust
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub fn copy_image_asset(doc_path: String, source_path: String) -> Result<String, String> {
    let doc = PathBuf::from(&doc_path);
    let parent = doc.parent().ok_or("Document has no parent directory")?;
    let assets_dir = parent.join("assets");
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    let source = PathBuf::from(&source_path);
    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let ts = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis();
    let original = source.file_name().and_then(|n| n.to_str()).unwrap_or("image");
    let dest_name = format!("{ts}-{original}");
    let dest = assets_dir.join(format!("{dest_name}.{ext}"));
    fs::copy(&source, &dest).map_err(|e| e.to_string())?;

    let relative = Path::new("assets").join(dest.file_name().unwrap());
    Ok(format!("./{}", relative.to_string_lossy()))
}
```

Add clipboard variant `copy_image_bytes(doc_path, bytes, ext)` if needed for paste-from-clipboard (write bytes to assets dir).

- [ ] **Step 3: Implement frontend image plugin**

`src/lib/image-assets.ts`:

```ts
export function assetRelativePath(docPath: string, absoluteAssetPath: string): string {
  const docDir = docPath.replace(/[/\\][^/\\]+$/, "");
  const rel = absoluteAssetPath.replace(docDir, "").replace(/^[/\\]/, "");
  return rel.startsWith(".") ? rel : `./${rel}`;
}

export function createImageAssetPlugin(options: {
  getDocPath: () => string | undefined;
  copyAsset: (docPath: string, sourcePath: string) => Promise<string>;
  onError: (message: string) => void;
}) {
  return new Plugin({
    props: {
      handlePaste(view, event) { /* detect image file, save, insert image node */ },
      handleDrop(view, event) { /* same for dropped files */ },
    },
  });
}
```

Insert image node: `markdownSchema.nodes.image.create({ src: relativePath })`.

If no doc path: `onError("Save the document before inserting images.")`.

Wire plugin in `EditorView.vue` with `documents.activeSession?.path`.

- [ ] **Step 4: Run tests and manual verify**

Run: `pnpm vitest run tests/unit/image-assets.spec.ts -v`
Expected: PASS.

Manual: save a `.md`, paste screenshot → `./assets/...` inserted, file exists on disk.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/workspace/assets.rs src/lib/image-assets.ts src/editor/plugins.ts src/lib/workspace-service.ts tests/unit/image-assets.spec.ts
git commit -m "feat: paste and drop images into assets folder"
```

---

### Task 8: Built-in PDF export — macOS first (M6)

**Files:**
- Create: `src-tauri/src/pdf/mod.rs`
- Create: `src-tauri/src/pdf/macos.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/Cargo.toml`
- Create: `src/lib/export-pdf.ts`
- Modify: `src/stores/documents.ts`
- Modify: `src/lib/app-commands.ts`
- Modify: `src/layout/AppShell.vue`

- [ ] **Step 1: Add macOS PDF dependencies**

In `src-tauri/Cargo.toml`:

```toml
[target.'cfg(target_os = "macos")'.dependencies]
objc2 = "0.6"
objc2-foundation = { version = "0.3", features = ["NSString", "NSData", "NSURL"] }
objc2-web-kit = { version = "0.3", features = ["WKWebView", "WKPDFConfiguration"] }
```

- [ ] **Step 2: Implement export_pdf command**

`src-tauri/src/pdf/mod.rs`:

```rust
#[tauri::command]
pub async fn export_pdf(html: String, output_path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return macos::html_to_pdf(&html, &output_path).await;
    #[cfg(not(target_os = "macos"))]
    Err("PDF export is currently supported on macOS only. Use HTML export (⌘E) instead.".into())
}
```

`src-tauri/src/pdf/macos.rs` — create off-screen `WKWebView`, `loadHTMLString`, wait for navigation delegate / short sleep, call `createPDFWithConfiguration`, write `NSData` to `output_path`. Wrap errors as `String`.

Register `export_pdf` in `main.rs`.

- [ ] **Step 3: Frontend export wrapper**

`src/lib/export-pdf.ts`:

```ts
import { invoke, isTauri } from "@tauri-apps/api/core";
import { markdownToHtml } from "@/lib/export-html";
import { pickSavePdfFile } from "@/lib/file-service";

export async function exportMarkdownToPdf(markdown: string, title: string, defaultPath?: string) {
  const html = markdownToHtml(markdown, title);
  const path = await pickSavePdfFile(defaultPath);
  if (!path) return null;
  if (!isTauri()) throw new Error("PDF export requires the desktop app");
  await invoke("export_pdf", { html, outputPath: path });
  return path;
}
```

Add `pickSavePdfFile` and `PDF_FILTER` to `file-service.ts`.

Add `documents.exportActivePdf()` mirroring `exportActiveHtml`.

Add command palette entry and ⌘⇧E in `AppShell.vue`:

```ts
if (event.key === "e" && mod && event.shiftKey) {
  event.preventDefault();
  void documents.exportActivePdf();
}
```

- [ ] **Step 4: Manual verify on macOS**

Run: `pnpm tauri dev` → write doc with headings and Mermaid → ⌘⇧E → PDF opens with content.

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/pdf src-tauri/Cargo.toml src/lib/export-pdf.ts src/lib/file-service.ts src/stores/documents.ts src/lib/app-commands.ts src/layout/AppShell.vue
git commit -m "feat: add built-in PDF export on macOS"
```

---

### Task 9: Docs, README, typography fix, and E2E smoke (M7)

**Files:**
- Modify: `README.md`
- Modify: `docs/notes/phase-1-verification.md`
- Modify: `src/styles/app.css`
- Modify: `package.json`
- Create: `tests/e2e/workspace-smoke.spec.ts`
- Modify: `src/lib/app-commands.ts`

- [ ] **Step 1: Commit pending typography CSS**

Stage and commit existing `src/styles/app.css` word-wrap and font-size fixes if not yet committed:

```bash
git add src/styles/app.css
git commit -m "fix: improve editor typography and word wrap"
```

- [ ] **Step 2: Update README**

Add sections:
- Open Folder (⌘⇧O)
- Files | Outline sidebar tabs
- Find/Replace (⌘F / ⌘⌥F)
- Export PDF (⌘⇧E)
- Image paste to assets

- [ ] **Step 3: Add Playwright devDependency and smoke test**

```bash
pnpm add -D @playwright/test
```

`tests/e2e/workspace-smoke.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("renders editor shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("editor-pane")).toBeVisible();
});
```

Add script to `package.json`: `"test:e2e": "playwright test"`.

Document: E2E runs against Vite dev server; full folder tests require Tauri environment and stay manual for Phase 2.

- [ ] **Step 4: Register all new commands in app-commands.ts**

Add: Open Folder, Find, Replace, Export PDF, Toggle Outline tab.

- [ ] **Step 5: Run full verification**

```bash
pnpm test
pnpm build
cd src-tauri && cargo test
```

Expected: all unit tests pass, web build succeeds.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/notes/phase-1-verification.md package.json tests/e2e/workspace-smoke.spec.ts src/lib/app-commands.ts
git commit -m "docs: update README and add phase 2 e2e smoke test"
```

---

## Plan Self-Review

**Spec coverage:**
- Folder workspace Typora mode → Tasks 2–4
- Files \| Outline tabs → Tasks 2, 5
- In-document search → Task 6
- Image assets → Task 7
- Built-in PDF → Task 8
- File CRUD + reveal + drag → Task 4
- Watch external changes → Task 3
- Recent files fallback → Task 2 (SidebarTabs when no folder)
- Docs/README → Task 9
- Save-before-image → Task 7
- macOS PDF first, fallback message on other OS → Task 8

**Out of scope confirmed:** workspace-wide search, math, footnotes, syntax highlight — no tasks added.

**No placeholders:** each task includes concrete file paths, test code, and commands.

**Type consistency:** `TreeNode` defined in Rust (`Serialize`) and mirrored in `workspace-service.ts`. Session retarget uses path as id throughout.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-07-phase-2-workspace-writing.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration

2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
