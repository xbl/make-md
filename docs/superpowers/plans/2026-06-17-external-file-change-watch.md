# External File Change Watch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When an opened Markdown file is modified by an external tool, the editor reflects the change in real-time — silently if the buffer is clean, with a Typora-style conflict prompt if the buffer is dirty.

**Architecture:** Per-file watching layered alongside the existing folder watcher. A single `notify::RecommendedWatcher` in Rust holds dynamic per-path subscriptions; the frontend registers each opened session and unregisters on close. A self-write timestamp suppresses bounceback from the app's own saves. Cursor position is preserved across silent reloads.

**Tech Stack:** Rust + `notify` 8.x, Tauri 2 commands and events, Vue 3 + Pinia + ProseMirror, Vitest for frontend tests, `tempfile` for Rust tests.

**Reference Spec:** `docs/superpowers/specs/2026-06-17-external-file-change-watch-design.md`

---

## File Structure

**New files:**
- `src-tauri/src/workspace/file_watch.rs` — Tauri state, two commands, debounced notify event loop
- `src/lib/file-watch.ts` — frontend wrapper for the two commands and the `file://changed` event
- `src/lib/external-change-prompt.ts` — three-way conflict prompt (reload / keep / cancel)

**Modified files:**
- `src-tauri/src/workspace/mod.rs` — `pub mod file_watch;`
- `src-tauri/src/main.rs` — register `FileWatchState` via `.manage(...)` and add the two new command handlers
- `src/lib/document-session.ts` — `isMissing` / `markMissing` accessors
- `src/stores/documents.ts` — `force` flag on `refreshSessionFromDisk`, self-write timestamp map, `handleExternalFileChange` action, lifecycle hooks in `openFile` / `closeSession` / `saveAsDialog` / `retargetSessionPath`, watch the saves in `getAutosaveQueue` and `saveActiveFile`
- `src/layout/AppShell.vue` — register `onFileChanged` listener, clean up in `onBeforeUnmount`
- `src/editor/EditorView.vue` — preserve cursor line/column in `syncViewFromSession`

**Test files (new):**
- Inline `#[cfg(test)] mod tests` in `src-tauri/src/workspace/file_watch.rs`
- `tests/unit/file-watch-prompt.spec.ts`
- `tests/unit/documents-external-change.spec.ts`
- `tests/unit/document-session-missing.spec.ts`

---

## Task 1: Backend file watcher state and commands

**Files:**
- Create: `src-tauri/src/workspace/file_watch.rs`
- Modify: `src-tauri/src/workspace/mod.rs`
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Write the failing Rust unit test**

Create `src-tauri/src/workspace/file_watch.rs` with the test module first (the rest is empty so it won't compile yet — that is the failure):

```rust
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};

const DEBOUNCE_MS: u64 = 100;

#[derive(Debug, Clone, Serialize)]
pub struct FileChangePayload {
    pub path: String,
    pub kind: String, // "modified" | "removed"
}

#[derive(Default)]
pub struct FileWatchState {
    inner: Mutex<Option<FileWatchInner>>,
}

struct FileWatchInner {
    watcher: RecommendedWatcher,
    paths: HashSet<PathBuf>,
}

impl FileWatchState {
    pub fn watch(&self, app: AppHandle, path: PathBuf) -> Result<(), String> {
        let mut guard = self.inner.lock().map_err(|err| err.to_string())?;
        if guard.is_none() {
            *guard = Some(spawn_watcher(app)?);
        }
        let inner = guard.as_mut().expect("inner");
        if inner.paths.contains(&path) {
            return Ok(());
        }
        inner
            .watcher
            .watch(&path, RecursiveMode::NonRecursive)
            .map_err(|err| err.to_string())?;
        inner.paths.insert(path);
        Ok(())
    }

    pub fn unwatch(&self, path: &Path) -> Result<(), String> {
        let mut guard = self.inner.lock().map_err(|err| err.to_string())?;
        let Some(inner) = guard.as_mut() else { return Ok(()) };
        if !inner.paths.remove(path) {
            return Ok(());
        }
        // Ignore unwatch errors (the file may have been removed already).
        let _ = inner.watcher.unwatch(path);
        Ok(())
    }
}

fn spawn_watcher(app: AppHandle) -> Result<FileWatchInner, String> {
    let (tx, rx) = mpsc::channel();
    let watcher = RecommendedWatcher::new(
        move |result: notify::Result<notify::Event>| {
            if let Ok(event) = result {
                let _ = tx.send(event);
            }
        },
        notify::Config::default(),
    )
    .map_err(|err| err.to_string())?;

    thread::spawn(move || run_event_loop(rx, app));

    Ok(FileWatchInner {
        watcher,
        paths: HashSet::new(),
    })
}

fn run_event_loop(rx: mpsc::Receiver<notify::Event>, app: AppHandle) {
    let mut pending: HashMap<PathBuf, Instant> = HashMap::new();
    let debounce = Duration::from_millis(DEBOUNCE_MS);
    loop {
        let timeout = pending
            .values()
            .map(|deadline| deadline.saturating_duration_since(Instant::now()))
            .min()
            .unwrap_or(Duration::from_secs(60));
        match rx.recv_timeout(timeout) {
            Ok(event) => {
                if !matches!(
                    event.kind,
                    EventKind::Modify(_)
                        | EventKind::Create(_)
                        | EventKind::Remove(_)
                        | EventKind::Any
                ) {
                    continue;
                }
                let deadline = Instant::now() + debounce;
                for path in event.paths {
                    pending.insert(path, deadline);
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => return,
        }
        let now = Instant::now();
        let mut ready: Vec<PathBuf> = Vec::new();
        pending.retain(|path, deadline| {
            if *deadline <= now {
                ready.push(path.clone());
                false
            } else {
                true
            }
        });
        for path in ready {
            let kind = if path.exists() { "modified" } else { "removed" };
            let payload = FileChangePayload {
                path: path.to_string_lossy().to_string(),
                kind: kind.to_string(),
            };
            let _ = app.emit("file://changed", payload);
        }
    }
}

#[tauri::command]
pub fn watch_file(
    app: AppHandle,
    state: State<'_, FileWatchState>,
    path: String,
) -> Result<(), String> {
    state.watch(app, PathBuf::from(path))
}

#[tauri::command]
pub fn unwatch_file(
    state: State<'_, FileWatchState>,
    path: String,
) -> Result<(), String> {
    state.unwatch(Path::new(&path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::mpsc::{channel, Sender};
    use std::sync::Arc;
    use tempfile::tempdir;

    // Minimal harness: bypass Tauri AppHandle by emitting through a Sender we own.
    fn spawn_test_watcher(tx: Sender<FileChangePayload>) -> (RecommendedWatcher, Arc<Mutex<HashSet<PathBuf>>>) {
        let (event_tx, event_rx) = channel();
        let watcher = RecommendedWatcher::new(
            move |result: notify::Result<notify::Event>| {
                if let Ok(event) = result {
                    let _ = event_tx.send(event);
                }
            },
            notify::Config::default(),
        )
        .unwrap();

        let paths = Arc::new(Mutex::new(HashSet::<PathBuf>::new()));
        let _paths_for_thread = paths.clone();
        thread::spawn(move || {
            let mut pending: HashMap<PathBuf, Instant> = HashMap::new();
            let debounce = Duration::from_millis(DEBOUNCE_MS);
            loop {
                let timeout = pending
                    .values()
                    .map(|d| d.saturating_duration_since(Instant::now()))
                    .min()
                    .unwrap_or(Duration::from_millis(50));
                match event_rx.recv_timeout(timeout) {
                    Ok(event) => {
                        if !matches!(
                            event.kind,
                            EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_) | EventKind::Any
                        ) {
                            continue;
                        }
                        let deadline = Instant::now() + debounce;
                        for path in event.paths {
                            pending.insert(path, deadline);
                        }
                    }
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                    Err(mpsc::RecvTimeoutError::Disconnected) => return,
                }
                let now = Instant::now();
                let mut ready: Vec<PathBuf> = Vec::new();
                pending.retain(|p, d| {
                    if *d <= now { ready.push(p.clone()); false } else { true }
                });
                for path in ready {
                    let kind = if path.exists() { "modified" } else { "removed" };
                    let _ = tx.send(FileChangePayload {
                        path: path.to_string_lossy().to_string(),
                        kind: kind.to_string(),
                    });
                }
            }
        });

        (watcher, paths)
    }

    #[test]
    fn detects_file_modification() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "first").unwrap();

        let (tx, rx) = channel::<FileChangePayload>();
        let (mut watcher, _paths) = spawn_test_watcher(tx);
        watcher.watch(&path, RecursiveMode::NonRecursive).unwrap();

        thread::sleep(Duration::from_millis(50));
        fs::write(&path, "second").unwrap();

        let payload = rx.recv_timeout(Duration::from_secs(2)).expect("event");
        assert_eq!(payload.kind, "modified");
        assert_eq!(payload.path, path.to_string_lossy());
    }

    #[test]
    fn reports_removed_when_file_deleted() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("note.md");
        fs::write(&path, "x").unwrap();

        let (tx, rx) = channel::<FileChangePayload>();
        let (mut watcher, _paths) = spawn_test_watcher(tx);
        watcher.watch(&path, RecursiveMode::NonRecursive).unwrap();

        thread::sleep(Duration::from_millis(50));
        fs::remove_file(&path).unwrap();

        let payload = rx.recv_timeout(Duration::from_secs(2)).expect("event");
        assert_eq!(payload.kind, "removed");
    }
}
```

- [ ] **Step 2: Run Rust tests to verify they fail / module doesn't compile yet**

Run: `cd src-tauri && cargo test --lib workspace::file_watch -- --nocapture`
Expected: compile error (`workspace::file_watch` not declared) — **this is the failure point that drives Step 3**.

- [ ] **Step 3: Wire the module into the workspace tree**

Edit `src-tauri/src/workspace/mod.rs` — add the new module:

```rust
pub mod tree;
pub mod watch;
pub mod files;
pub mod assets;
pub mod file_watch;
```

- [ ] **Step 4: Run Rust tests again to verify they now compile and pass**

Run: `cd src-tauri && cargo test --lib workspace::file_watch -- --nocapture`
Expected: 2 tests pass (`detects_file_modification`, `reports_removed_when_file_deleted`). If FSEvents on macOS is sluggish, the 2-second timeout already accounts for it.

- [ ] **Step 5: Register state and commands in main.rs**

Edit `src-tauri/src/main.rs`:

```rust
mod ai;
mod fs;
mod i18n;
mod menu;
mod pdf;
mod recent;
mod recovery;
mod workspace;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(workspace::file_watch::FileWatchState::default())
        .setup(|app| {
            menu::install_menu(app)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event);
        })
        .invoke_handler(tauri::generate_handler![
            ai::ai_stream,
            ai::ai_cancel,
            ai::save_api_key,
            ai::load_api_key,
            i18n::get_system_locale,
            fs::read_markdown_file,
            fs::read_binary_file,
            fs::write_markdown_file,
            fs::write_binary_file,
            fs::pick_save_word_file,
            menu::sync_menu_locale,
            recent::load_recent_files,
            recent::save_recent_file,
            recent::remove_recent_file,
            recent::clear_recent_files,
            recovery::save_recovery_snapshot,
            recovery::load_recovery_snapshot,
            recovery::clear_recovery_snapshot,
            workspace::tree::list_markdown_tree,
            workspace::watch::watch_folder,
            workspace::file_watch::watch_file,
            workspace::file_watch::unwatch_file,
            workspace::files::create_file,
            workspace::files::rename_file,
            workspace::files::delete_file,
            workspace::files::move_file,
            workspace::files::reveal_in_finder,
            workspace::assets::copy_image_asset,
            workspace::assets::copy_image_bytes,
            pdf::export_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run make-md");
}
```

- [ ] **Step 6: Verify the full Rust build still passes**

Run: `cd src-tauri && cargo check`
Expected: compile succeeds, no warnings about unused imports in `file_watch.rs`.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/workspace/file_watch.rs src-tauri/src/workspace/mod.rs src-tauri/src/main.rs
git commit -m "feat(watch): add per-file watcher commands and Tauri state"
```

---

## Task 2: Frontend wrapper for the file watcher

**Files:**
- Create: `src/lib/file-watch.ts`

- [ ] **Step 1: Write the file**

```ts
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type FileChangeKind = "modified" | "removed";

export type FileChangePayload = {
  path: string;
  kind: FileChangeKind;
};

export async function watchFile(path: string): Promise<void> {
  if (!isTauri()) {
    return;
  }
  await invoke("watch_file", { path });
}

export async function unwatchFile(path: string): Promise<void> {
  if (!isTauri()) {
    return;
  }
  await invoke("unwatch_file", { path });
}

export async function onFileChanged(
  handler: (payload: FileChangePayload) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  return listen<FileChangePayload>("file://changed", (event) => {
    handler(event.payload);
  });
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm typecheck`
Expected: no errors. (No tests yet — the wrapper has no logic to test.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/file-watch.ts
git commit -m "feat(watch): add frontend wrapper for file change events"
```

---

## Task 3: Session `isMissing` flag

**Files:**
- Modify: `src/lib/document-session.ts`
- Test: `tests/unit/document-session-missing.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/document-session-missing.spec.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDocumentSession } from "@/lib/document-session";

describe("document session missing flag", () => {
  it("starts not missing", () => {
    const session = createDocumentSession({ id: "/x.md", path: "/x.md", content: "" });
    expect(session.isMissing()).toBe(false);
  });

  it("can be marked missing and back", () => {
    const session = createDocumentSession({ id: "/x.md", path: "/x.md", content: "" });
    session.markMissing(true);
    expect(session.isMissing()).toBe(true);
    session.markMissing(false);
    expect(session.isMissing()).toBe(false);
  });

  it("clears missing on markSaved", () => {
    const session = createDocumentSession({ id: "/x.md", path: "/x.md", content: "" });
    session.markMissing(true);
    session.markSaved("new");
    expect(session.isMissing()).toBe(false);
  });

  it("clears missing on updateContent", () => {
    const session = createDocumentSession({ id: "/x.md", path: "/x.md", content: "" });
    session.markMissing(true);
    session.updateContent("typed");
    expect(session.isMissing()).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/unit/document-session-missing.spec.ts`
Expected: FAIL — `session.isMissing is not a function`.

- [ ] **Step 3: Implement the missing flag**

Edit `src/lib/document-session.ts` — full new file content:

```ts
export type DocumentSessionInput = {
  id: string;
  path: string;
  content: string;
};

export function createDocumentSession(input: DocumentSessionInput) {
  let content = input.content;
  let savedContent = input.content;
  let dirty = false;
  let missing = false;

  return {
    id: input.id,
    get path() {
      return input.path;
    },
    get content() {
      return content;
    },
    updateContent(nextContent: string) {
      content = nextContent;
      dirty = nextContent !== savedContent;
      missing = false;
    },
    setPath(nextPath: string) {
      input.path = nextPath;
    },
    markDirty() {
      dirty = true;
    },
    markSaved(nextSavedContent: string) {
      content = nextSavedContent;
      savedContent = nextSavedContent;
      dirty = false;
      missing = false;
    },
    isDirty() {
      return dirty;
    },
    isMissing() {
      return missing;
    },
    markMissing(value: boolean) {
      missing = value;
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/unit/document-session-missing.spec.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Run the full unit suite to make sure nothing else broke**

Run: `pnpm test`
Expected: all previously passing tests still pass. (Existing `documents-external-refresh.spec.ts` does not exercise `isMissing`, so it remains green.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/document-session.ts tests/unit/document-session-missing.spec.ts
git commit -m "feat(session): add isMissing flag tracking external deletion"
```

---

## Task 4: External-change conflict prompt

**Files:**
- Create: `src/lib/external-change-prompt.ts`
- Test: `tests/unit/file-watch-prompt.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/file-watch-prompt.spec.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  ask: vi.fn(),
}));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
}));

describe("promptExternalChange", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'reload' when user accepts the first prompt", async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    vi.mocked(dialog.ask).mockResolvedValueOnce(true);

    const { promptExternalChange } = await import("@/lib/external-change-prompt");
    const action = await promptExternalChange("note.md");

    expect(action).toBe("reload");
    expect(dialog.ask).toHaveBeenCalledTimes(1);
  });

  it("returns 'keep' when user declines reload but accepts keep", async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    vi.mocked(dialog.ask)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const { promptExternalChange } = await import("@/lib/external-change-prompt");
    const action = await promptExternalChange("note.md");

    expect(action).toBe("keep");
    expect(dialog.ask).toHaveBeenCalledTimes(2);
  });

  it("returns 'cancel' when user declines both prompts", async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    vi.mocked(dialog.ask)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);

    const { promptExternalChange } = await import("@/lib/external-change-prompt");
    const action = await promptExternalChange("note.md");

    expect(action).toBe("cancel");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/unit/file-watch-prompt.spec.ts`
Expected: FAIL — module `@/lib/external-change-prompt` does not exist.

- [ ] **Step 3: Create the prompt module**

Create `src/lib/external-change-prompt.ts`:

```ts
import { ask } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";

export type ExternalChangeAction = "reload" | "keep" | "cancel";

export async function promptExternalChange(fileName: string): Promise<ExternalChangeAction> {
  if (!isTauri()) {
    return "keep";
  }

  const reload = await ask(
    `"${fileName}" was modified by another program. Reload from disk and discard your local changes?`,
    { title: "File Changed Externally", kind: "warning" },
  );
  if (reload) {
    return "reload";
  }

  const keep = await ask(
    `Keep your unsaved version of "${fileName}"? Saving later will overwrite the external changes.`,
    { title: "Keep Local Version", kind: "warning" },
  );
  return keep ? "keep" : "cancel";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test tests/unit/file-watch-prompt.spec.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/external-change-prompt.ts tests/unit/file-watch-prompt.spec.ts
git commit -m "feat(watch): add three-way external-change conflict prompt"
```

---

## Task 5: `force` flag on `refreshSessionFromDisk`

**Files:**
- Modify: `src/stores/documents.ts:169-179`
- Test: extend `tests/unit/documents-external-refresh.spec.ts`

- [ ] **Step 1: Add a failing test for the force flag**

Append to `tests/unit/documents-external-refresh.spec.ts` (inside the existing `describe` block, after the second `it`):

```ts
  it("force-refreshes a dirty session when force=true", async () => {
    const fileService = await import("@/lib/file-service");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockReset();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/tmp/note.md", content: "first" });
    const session = await store.openFile("/tmp/note.md");
    session?.updateContent("local edits");

    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/tmp/note.md", content: "second" });
    const refreshed = await store.refreshSessionFromDisk("/tmp/note.md", true);

    expect(refreshed).toBe(true);
    expect(store.activeSession?.content).toBe("second");
    expect(store.activeSession?.isDirty()).toBe(false);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/unit/documents-external-refresh.spec.ts`
Expected: FAIL — current `refreshSessionFromDisk` ignores the second argument and returns `false` because the session is dirty.

- [ ] **Step 3: Add the `force` parameter**

Edit `src/stores/documents.ts` — replace the existing `refreshSessionFromDisk` action (around line 169):

```ts
    async refreshSessionFromDisk(path: string, force = false) {
      const session = this.sessions.find((item) => item.path === path || item.id === path);
      if (!session) {
        return false;
      }
      if (!force && session.isDirty()) {
        return false;
      }

      const { content } = await readMarkdownFile(path);
      session.markSaved(content);
      this.sessions = [...this.sessions];
      return true;
    },
```

- [ ] **Step 4: Run the tests to verify all three pass**

Run: `pnpm test tests/unit/documents-external-refresh.spec.ts`
Expected: 3 tests pass (the two original plus the new one).

- [ ] **Step 5: Commit**

```bash
git add src/stores/documents.ts tests/unit/documents-external-refresh.spec.ts
git commit -m "feat(documents): allow forced refresh of dirty sessions"
```

---

## Task 6: External-change handler in documents store

**Files:**
- Modify: `src/stores/documents.ts`
- Test: `tests/unit/documents-external-change.spec.ts`

This task introduces the self-write timestamp map and the `handleExternalFileChange` action, but does **not** wire `watchFile` / `unwatchFile` into the lifecycle yet (Task 7 does that).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/documents-external-change.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useDocumentsStore } from "@/stores/documents";

vi.mock("@/lib/file-service", () => ({
  loadRecentFiles: vi.fn(async () => []),
  pickMarkdownFile: vi.fn(async () => null),
  pickSaveHtmlFile: vi.fn(async () => null),
  pickSaveMarkdownFile: vi.fn(async () => null),
  readMarkdownFile: vi.fn(),
  saveRecentFile: vi.fn(async (path: string) => [path]),
  writeMarkdownFile: vi.fn(async () => {}),
  writeTextFile: vi.fn(async () => {}),
}));

vi.mock("@/lib/file-watch", () => ({
  watchFile: vi.fn(async () => {}),
  unwatchFile: vi.fn(async () => {}),
}));

vi.mock("@/lib/external-change-prompt", () => ({
  promptExternalChange: vi.fn(),
}));

describe("documents handleExternalFileChange", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("reloads silently when the session is clean", async () => {
    const fileService = await import("@/lib/file-service");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
    await store.openFile("/a.md");

    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "new" });
    await store.handleExternalFileChange({ path: "/a.md", kind: "modified" });

    expect(store.activeSession?.content).toBe("new");
  });

  it("prompts when the session is dirty and reloads on 'reload'", async () => {
    const fileService = await import("@/lib/file-service");
    const prompt = await import("@/lib/external-change-prompt");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
    const session = await store.openFile("/a.md");
    session?.updateContent("local");

    vi.mocked(prompt.promptExternalChange).mockResolvedValueOnce("reload");
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "new" });
    await store.handleExternalFileChange({ path: "/a.md", kind: "modified" });

    expect(store.activeSession?.content).toBe("new");
    expect(store.activeSession?.isDirty()).toBe(false);
  });

  it("prompts when dirty and keeps local on 'keep'", async () => {
    const fileService = await import("@/lib/file-service");
    const prompt = await import("@/lib/external-change-prompt");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
    const session = await store.openFile("/a.md");
    session?.updateContent("local");

    vi.mocked(prompt.promptExternalChange).mockResolvedValueOnce("keep");
    await store.handleExternalFileChange({ path: "/a.md", kind: "modified" });

    expect(store.activeSession?.content).toBe("local");
    expect(store.activeSession?.isDirty()).toBe(true);
  });

  it("marks missing on removed event", async () => {
    const fileService = await import("@/lib/file-service");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
    await store.openFile("/a.md");

    await store.handleExternalFileChange({ path: "/a.md", kind: "removed" });

    expect(store.activeSession?.isMissing()).toBe(true);
    expect(store.activeSession?.content).toBe("old");
  });

  it("ignores changes within self-write window", async () => {
    const fileService = await import("@/lib/file-service");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
    await store.openFile("/a.md");

    // Simulate a recent self-write by saving.
    vi.mocked(fileService.writeMarkdownFile).mockResolvedValueOnce(undefined as never);
    await store.saveActiveFile();

    vi.mocked(fileService.readMarkdownFile).mockClear();
    await store.handleExternalFileChange({ path: "/a.md", kind: "modified" });

    expect(fileService.readMarkdownFile).not.toHaveBeenCalled();
  });

  it("processes the change after the self-write window expires", async () => {
    vi.useFakeTimers();
    try {
      const fileService = await import("@/lib/file-service");
      const store = useDocumentsStore();
      vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "old" });
      await store.openFile("/a.md");
      vi.mocked(fileService.writeMarkdownFile).mockResolvedValueOnce(undefined as never);
      await store.saveActiveFile();

      vi.advanceTimersByTime(600); // > SELF_WRITE_IGNORE_MS (500)
      vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "new" });
      await store.handleExternalFileChange({ path: "/a.md", kind: "modified" });

      expect(store.activeSession?.content).toBe("new");
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test tests/unit/documents-external-change.spec.ts`
Expected: FAIL — `store.handleExternalFileChange is not a function`.

- [ ] **Step 3: Add the self-write tracking and the handler**

Edit `src/stores/documents.ts`:

(a) Add module-level state near the top, **after** the `let autosaveQueue` line (around line 24):

```ts
const SELF_WRITE_IGNORE_MS = 500;
const selfWriteTimestamps = new Map<string, number>();

function markSelfWrite(path: string) {
  if (!path) return;
  selfWriteTimestamps.set(path, Date.now());
}

function isRecentSelfWrite(path: string): boolean {
  const last = selfWriteTimestamps.get(path);
  return last !== undefined && Date.now() - last < SELF_WRITE_IGNORE_MS;
}
```

(b) Inside the `getAutosaveQueue` action, mark a self-write **after** the successful `writeMarkdownFile`:

```ts
      autosaveQueue = createAutosaveQueue(async (content: string) => {
        const session = this.activeSession;
        if (!session?.path) {
          return;
        }
        await writeMarkdownFile(session.path, content);
        markSelfWrite(session.path);
        session.markSaved(content);
        await clearRecoverySnapshot(session.id);
      });
```

(c) In `saveActiveFile`, mark a self-write right after the `writeMarkdownFile` call (around line 125):

```ts
    async saveActiveFile() {
      const session = this.activeSession;
      if (!session) {
        return null;
      }
      if (!session.path) {
        return this.saveAsDialog();
      }

      await this.flushAutosave();
      await writeMarkdownFile(session.path, session.content);
      markSelfWrite(session.path);
      session.markSaved(session.content);
      this.recentFiles = await saveRecentFile(session.path);
      await clearRecoverySnapshot(session.id);
      return session.path;
    },
```

(d) In `saveAsDialog`, mark a self-write right after the `writeMarkdownFile` call (around line 142):

```ts
      await writeMarkdownFile(path, session.content);
      markSelfWrite(path);
```

(e) Add the new action `handleExternalFileChange` next to `refreshSessionFromDisk`. Place it directly **after** `refreshSessionFromDisk` for locality, and add the import at the top of the file:

```ts
import { promptExternalChange } from "@/lib/external-change-prompt";
```

```ts
    async handleExternalFileChange(payload: { path: string; kind: "modified" | "removed" }) {
      if (isRecentSelfWrite(payload.path)) {
        return;
      }
      const session = this.sessions.find((item) => item.path === payload.path);
      if (!session) {
        return;
      }
      if (payload.kind === "removed") {
        session.markMissing(true);
        this.sessions = [...this.sessions];
        return;
      }
      if (!session.isDirty()) {
        await this.refreshSessionFromDisk(payload.path);
        return;
      }
      const action = await promptExternalChange(sessionLabel(session));
      if (action === "reload") {
        await this.refreshSessionFromDisk(payload.path, true);
      }
    },
```

- [ ] **Step 4: Run the tests to verify they all pass**

Run: `pnpm test tests/unit/documents-external-change.spec.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Run the full unit suite to confirm no regressions**

Run: `pnpm test`
Expected: every prior test still passes.

- [ ] **Step 6: Commit**

```bash
git add src/stores/documents.ts tests/unit/documents-external-change.spec.ts
git commit -m "feat(documents): handle external file changes with conflict prompt"
```

---

## Task 7: Lifecycle hooks — register/unregister watcher per session

**Files:**
- Modify: `src/stores/documents.ts`
- Test: extend `tests/unit/documents-external-change.spec.ts`

- [ ] **Step 1: Add failing tests for the lifecycle hooks**

Append to `tests/unit/documents-external-change.spec.ts` (inside the same `describe`):

```ts
  it("calls watchFile when opening a path-backed session", async () => {
    const fileService = await import("@/lib/file-service");
    const fileWatch = await import("@/lib/file-watch");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "" });
    await store.openFile("/a.md");
    expect(fileWatch.watchFile).toHaveBeenCalledWith("/a.md");
  });

  it("calls unwatchFile when closing a session", async () => {
    const fileService = await import("@/lib/file-service");
    const fileWatch = await import("@/lib/file-watch");
    const store = useDocumentsStore();
    vi.mocked(fileService.readMarkdownFile).mockResolvedValueOnce({ path: "/a.md", content: "" });
    await store.openFile("/a.md");
    vi.mocked(fileWatch.unwatchFile).mockClear();
    await store.closeSession("/a.md");
    expect(fileWatch.unwatchFile).toHaveBeenCalledWith("/a.md");
  });

  it("does not call watchFile for untitled sessions", async () => {
    const fileWatch = await import("@/lib/file-watch");
    const store = useDocumentsStore();
    vi.mocked(fileWatch.watchFile).mockClear();
    store.createNewDocument();
    expect(fileWatch.watchFile).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test tests/unit/documents-external-change.spec.ts`
Expected: 3 new tests fail (`watchFile`/`unwatchFile` not called).

- [ ] **Step 3: Wire the lifecycle hooks**

Edit `src/stores/documents.ts`:

(a) Add the import at the top of the file:

```ts
import { watchFile, unwatchFile } from "@/lib/file-watch";
```

(b) In the `openFile` action, after the new session has been added via `this.openSession(session)`, call `watchFile`:

```ts
    async openFile(path: string) {
      const existing = this.sessions.find((session) => session.path === path || session.id === path);
      if (existing) {
        this.activeSessionId = existing.id;
        return existing;
      }

      const restored = await loadRecoverySnapshot(path);
      const { content } = restored ? { content: restored } : await readMarkdownFile(path);
      const session = createDocumentSession({
        id: path,
        path,
        content,
      });
      this.openSession(session);
      void watchFile(path);
      this.recentFiles = await saveRecentFile(path);
      if (restored) {
        session.markDirty();
      }
      return session;
    },
```

(c) In `closeSession`, after the session is removed (the line `this.sessions = this.sessions.filter(...)`), unwatch if a path is present:

```ts
      this.sessions = this.sessions.filter((item) => item.id !== id);
      if (session.path) {
        void unwatchFile(session.path);
      }
      if (this.activeSessionId === id) {
        this.activeSessionId = this.sessions[this.sessions.length - 1]?.id ?? "";
      }
      return true;
```

(d) In `saveAsDialog`, after the path swap, swap the watcher subscription. Find the block where `previousId` is captured and the new session is created, and add the unwatch/watch around the `writeMarkdownFile`:

```ts
      await writeMarkdownFile(path, session.content);
      markSelfWrite(path);
      const previousId = session.id;
      const previousPath = session.path;
      session.setPath(path);
      session.markSaved(session.content);

      const nextSession = createDocumentSession({
        id: path,
        path,
        content: session.content,
      });
      this.sessions = this.sessions.filter((item) => item.id !== previousId);
      this.openSession(nextSession);
      if (previousPath) {
        void unwatchFile(previousPath);
      }
      void watchFile(path);
      this.recentFiles = await saveRecentFile(path);
      await clearRecoverySnapshot(path);
      await clearRecoverySnapshot(previousId);
      return path;
```

(e) In `retargetSessionPath`, swap the watcher when the path changes:

```ts
    retargetSessionPath(oldPath: string, newPath: string) {
      const session = this.sessions.find((item) => item.id === oldPath || item.path === oldPath);
      if (!session) {
        return;
      }
      const content = session.content;
      const nextSession = createDocumentSession({
        id: newPath,
        path: newPath,
        content,
      });
      if (session.isDirty()) {
        nextSession.markDirty();
      }
      this.sessions = this.sessions
        .filter((item) => item.id !== oldPath && item.path !== oldPath)
        .concat(nextSession);
      if (this.activeSessionId === oldPath) {
        this.activeSessionId = newPath;
      }
      void unwatchFile(oldPath);
      void watchFile(newPath);
    },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test tests/unit/documents-external-change.spec.ts`
Expected: all tests in this file pass (6 from Task 6 + 3 new = 9 total).

- [ ] **Step 5: Run the full unit suite again**

Run: `pnpm test`
Expected: every prior test still passes. Note: `documents-retarget.spec.ts` exists; it should continue to pass because the new `unwatchFile`/`watchFile` calls are mocked at module boundary in tests that import `@/lib/file-watch`. If `documents-retarget.spec.ts` fails because of the unmocked import, add the same `vi.mock("@/lib/file-watch", ...)` block at the top of that file (no other changes).

- [ ] **Step 6: Commit**

```bash
git add src/stores/documents.ts tests/unit/documents-external-change.spec.ts tests/unit/documents-retarget.spec.ts
git commit -m "feat(documents): wire watch/unwatch into session lifecycle"
```

---

## Task 8: AppShell wiring

**Files:**
- Modify: `src/layout/AppShell.vue`

- [ ] **Step 1: Add the import and listener**

Find the existing `import { onWorkspaceChanged ... }` import block in `src/layout/AppShell.vue` and the `onMounted`/`onBeforeUnmount` blocks. Add a sibling listener:

(a) Add to imports:

```ts
import { onFileChanged } from "@/lib/file-watch";
```

(b) Add a ref alongside the other `unlisten*` variables:

```ts
let stopFileChangeWatch: (() => void) | null = null;
```

(c) Inside `onMounted`, after `stopWorkspaceChangeWatch = await onWorkspaceChanged(...)` (line ~336), append:

```ts
  stopFileChangeWatch = await onFileChanged((payload) => {
    void documents.handleExternalFileChange(payload);
  });
```

(d) Inside `onBeforeUnmount`, alongside the other cleanups:

```ts
  stopFileChangeWatch?.();
```

- [ ] **Step 2: Type-check**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Run the unit suite to confirm AppShell tests still pass**

Run: `pnpm test tests/unit/app-shell.spec.ts`
Expected: pass. If `app-shell.spec.ts` doesn't mock `@/lib/file-watch`, add this at the top of that test file:

```ts
vi.mock("@/lib/file-watch", () => ({
  watchFile: vi.fn(async () => {}),
  unwatchFile: vi.fn(async () => {}),
  onFileChanged: vi.fn(async () => () => {}),
}));
```

- [ ] **Step 4: Commit**

```bash
git add src/layout/AppShell.vue tests/unit/app-shell.spec.ts
git commit -m "feat(app-shell): forward file-change events to documents store"
```

---

## Task 9: Cursor preservation in `syncViewFromSession`

**Files:**
- Modify: `src/editor/EditorView.vue:321-350`

- [ ] **Step 1: Read the current implementation**

Open `src/editor/EditorView.vue` and locate `syncViewFromSession` (around line 321). The current body rebuilds the entire `EditorState`, which collapses the cursor to position 0.

- [ ] **Step 2: Replace the function body**

Replace the existing `syncViewFromSession` function with the version below, which captures the prior selection's `from` index, finds the resolved position in the new doc, and clamps if out of range:

```ts
function syncViewFromSession() {
  const session = activeSession.value;
  if (!session || !view) {
    return;
  }

  const currentContent = serializeMarkdown(view.state.doc);
  if (currentContent === session.content) {
    return;
  }

  const previousFrom = view.state.selection.from;
  const previousDocSize = view.state.doc.content.size;
  const fractionFromStart = previousDocSize > 0 ? previousFrom / previousDocSize : 0;

  const nextDoc = parseMarkdown(session.content || "", session.path || undefined);
  const nextDocSize = nextDoc.content.size;
  let targetPos = Math.min(previousFrom, nextDocSize);
  // If the doc shrank a lot, fall back to the same fractional position so the cursor
  // doesn't end up far past the end of meaningful content.
  if (targetPos === nextDocSize && previousFrom > nextDocSize) {
    targetPos = Math.max(0, Math.floor(fractionFromStart * nextDocSize));
  }

  const nextState = EditorState.create({
    schema: markdownSchema,
    doc: nextDoc,
    plugins: createEditorPlugins({
      getDocPath: () => activeSession.value?.path || undefined,
      onImageError: (message) => window.alert(message),
    }),
  });

  // Apply the preserved cursor position via a transaction on the fresh state.
  let stateWithSelection = nextState;
  try {
    const $pos = nextState.doc.resolve(Math.min(targetPos, nextState.doc.content.size));
    stateWithSelection = nextState.apply(
      nextState.tr.setSelection(TextSelection.near($pos)),
    );
  } catch {
    // Fall back silently if the position can't be resolved (e.g., empty doc).
  }

  const hadFocus = view.hasFocus();
  view.updateState(stateWithSelection);
  editorStore.bumpDocVersion();
  updateSelectionToolbar();
  updateTableOverlay();
  if (hadFocus) {
    view.focus();
  }
}
```

- [ ] **Step 3: Add the missing import**

In the imports block at the top of `src/editor/EditorView.vue`, change:

```ts
import { EditorState } from "prosemirror-state";
```

to:

```ts
import { EditorState, TextSelection } from "prosemirror-state";
```

- [ ] **Step 4: Type-check**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Run the unit suite**

Run: `pnpm test`
Expected: every test still passes. (Existing `editor` tests don't assert cursor position across reloads, so they remain green; the new behavior is verified manually in Task 10.)

- [ ] **Step 6: Commit**

```bash
git add src/editor/EditorView.vue
git commit -m "feat(editor): preserve cursor position across external reloads"
```

---

## Task 10: Manual verification in the running app

**Files:** none (this is hands-on verification, no code changes)

- [ ] **Step 1: Build and start the desktop app**

Run: `pnpm tauri:dev`
Expected: the app launches, no Rust panics in the console.

- [ ] **Step 2: Single-file external modify (the original bug)**

In the app, **Open File…** a temporary `.md` outside any folder workspace. In a terminal, run:

```bash
echo "external addition $(date)" >> /path/to/that/file.md
```

Expected: the editor reflects the appended line within ~200 ms with no prompt; the cursor stays roughly where it was; `editorStore` doc version bumps once (visible by checking devtools or by observing no flicker).

- [ ] **Step 3: Conflict — reload path**

In the editor, type a few unsaved characters. Then run the same `echo` command. A native dialog appears asking to reload from disk. Click **Yes**. Expected: editor content is replaced by the disk content, dirty indicator clears.

- [ ] **Step 4: Conflict — keep path**

Repeat: dirty the buffer, modify externally. Decline the first dialog. A second dialog asks to keep the local version. Click **Yes**. Expected: editor content unchanged, still dirty. Save (Cmd+S). Expected: disk content is overwritten with the local version.

- [ ] **Step 5: Conflict — cancel path**

Dirty the buffer, modify externally. Decline both dialogs. Expected: editor content unchanged, still dirty. No further action; subsequent edits continue normally.

- [ ] **Step 6: Self-write does not bounce back**

Save the file via Cmd+S. Watch the console (run with `RUST_LOG=info` in another terminal if desired). Expected: no second prompt, no log of `handleExternalFileChange` reading from disk in response to the save.

- [ ] **Step 7: Atomic-rename save**

In another terminal, run:

```bash
vim /path/to/that/file.md   # add a line, :wq
```

Expected: a single silent reload, no flicker, cursor preserved on its prior line. (vim performs an atomic rename on save.)

- [ ] **Step 8: External delete**

Run: `rm /path/to/that/file.md`
Expected: editor content remains in memory, no crash. (UI badge for missing files is out of scope for this plan; verify via Vue devtools that `documents.activeSession.isMissing()` returns `true`.)

- [ ] **Step 9: Multi-tab — only the affected tab reloads**

Open three different `.md` files. Modify only the second one externally. Expected: only that tab's content updates; the other tabs' contents and scroll positions are untouched. (This implicitly verifies the path-targeted dispatch.)

- [ ] **Step 10: Folder workspace coexistence**

Open a folder workspace, then open a single `.md` outside that workspace. Modify the in-workspace file externally → editor reloads. Modify the out-of-workspace file externally → editor reloads. (Both pipelines coexist; this confirms the new watcher doesn't collide with `workspace://changed`.)

- [ ] **Step 11: Final commit message and PR-ready check**

Run: `pnpm test && pnpm typecheck && (cd src-tauri && cargo test)`
Expected: all green.

If everything in steps 1–10 behaves as described, the feature is complete. If any step reveals a regression, file a sub-task and fix before marking the plan done — do not paper over with try/catch.

```bash
# Optional final tag commit (no code; just a marker if you want one):
# git commit --allow-empty -m "chore: external file change watch verified"
```

---

## Self-Review

This block is the author's checklist; it does not need to be re-run by the executor.

**Spec coverage:**
- ✅ Backend per-file watcher → Task 1
- ✅ `file://changed` payload with path + kind → Task 1
- ✅ Frontend wrapper + listener → Tasks 2 & 8
- ✅ Self-write ignore window → Task 6
- ✅ `force` flag on refresh → Task 5
- ✅ `handleExternalFileChange` w/ dirty branching → Task 6
- ✅ Conflict prompt → Task 4
- ✅ Lifecycle hooks (open/close/save-as/retarget) → Task 7
- ✅ `isMissing` on session → Task 3
- ✅ Cursor preservation on silent reload → Task 9
- ✅ Atomic-rename, removed-as-modify-when-exists → Task 1 event loop
- ✅ Manual end-to-end check → Task 10

**Placeholder scan:** No "TBD" / "TODO" / "similar to" / "handle edge cases" markers. Each step contains the actual code or command.

**Type consistency:**
- `FileChangeKind = "modified" | "removed"` is shared between the wrapper, store action, and prompt — verified.
- `markSelfWrite` / `isRecentSelfWrite` signatures consistent across calls.
- `refreshSessionFromDisk(path: string, force = false)` matches all four call sites (Tasks 5 & 6).
- `watchFile` / `unwatchFile` accept `string`; called with `session.path` everywhere.
