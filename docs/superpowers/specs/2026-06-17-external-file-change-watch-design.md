# External File Change Watch Design

**Date:** 2026-06-17
**Status:** Approved
**Goal:** When a Markdown file opened in the editor is modified by another tool on disk, the in-app editor reflects the change in real-time. Behavior mirrors Typora: silent reload when the buffer is clean, conflict prompt when the buffer is dirty.

---

## Problem

The app already has a folder watcher (`src-tauri/src/workspace/watch.rs`) that emits `workspace://changed` whenever any file under the active workspace folder changes. The frontend (`AppShell.vue`) listens and calls `documents.refreshSessionFromDisk(path)` for every open session.

That mechanism has three gaps:

1. **No watcher when no folder workspace is open.** Users who open a single file via "Open File…" without a workspace get zero file-change notifications. External edits never reach the editor — the bug being fixed.
2. **Files outside the active workspace folder are not watched.** A side effect of folder-scoped watching.
3. **Dirty buffers silently drop external changes.** If the user has unsaved local edits and an external tool also writes the same file, `refreshSessionFromDisk` returns `false` with no UI signal.

The user's requested scope is gap #1; the chosen approach naturally also resolves #2 and addresses #3 in a Typora-like way.

---

## Approach

Add per-file watching, layered alongside (not replacing) the existing folder watcher. Each opened document registers itself with a global file watcher in Rust; on disk change, the frontend reloads only that one session.

Mirror Typora's two-mode reconciliation:

- **Clean buffer** → silent reload, preserve cursor line/column when feasible.
- **Dirty buffer** → modal conflict prompt with three outcomes: reload-and-discard, keep-local, cancel.

Suppress self-triggered events with a short ignore window after every write, so the app's own saves do not bounce back as "external" changes.

---

## Architecture

### Backend (Rust)

New module `src-tauri/src/workspace/file_watch.rs`:

- A struct `FileWatchState` held in Tauri's managed state, containing:
  - `watcher: Mutex<Option<RecommendedWatcher>>` — single shared watcher, lazily initialized on first `watch_file` call.
  - `paths: Mutex<HashSet<PathBuf>>` — currently-watched file paths, used to make `watch_file`/`unwatch_file` idempotent.
- Two new Tauri commands:
  - `watch_file(path: String) -> Result<(), String>` — calls `watcher.watch(path, RecursiveMode::NonRecursive)` and inserts into the set. No-op if already watched.
  - `unwatch_file(path: String) -> Result<(), String>` — calls `watcher.unwatch(path)` and removes from the set. No-op if not watched.
- A debouncing event loop (100 ms coalescing window per path) emits the Tauri event `file://changed` with payload `{ path: String, kind: "modified" | "removed" }`. Mapping from `notify` event kinds:
  - `Modify(_)` and `Create(_)` → `"modified"`
  - `Remove(_)` → `"removed"`
  - `Rename` events → `"modified"` if the path still exists on disk after the debounce window; `"removed"` if not. (notify's `Rename` semantics differ across platforms, so we resolve via a `Path::exists()` check at flush time.)
  - Within a single 100 ms debounce window for a path, if both a remove-class and a modify-class event are seen, the final emission is `"modified"` if the path exists at flush time, else `"removed"`.
- Registered in `src-tauri/src/main.rs` via `.manage(FileWatchState::default())` and added to the `invoke_handler` list.
- Exported from `src-tauri/src/workspace/mod.rs`.

### Frontend

New module `src/lib/file-watch.ts` wrapping the Tauri commands and event:

```ts
export async function watchFile(path: string): Promise<void>;
export async function unwatchFile(path: string): Promise<void>;
export async function onFileChanged(
  handler: (payload: { path: string; kind: "modified" | "removed" }) => void
): Promise<UnlistenFn>;
```

When `isTauri()` is false, all three functions become no-ops (e2e tests don't depend on this path).

### Document store integration (`src/stores/documents.ts`)

Track per-path self-write timestamps to debounce our own saves:

```ts
const selfWriteTimestamps = new Map<string, number>();
const SELF_WRITE_IGNORE_MS = 500;

function markSelfWrite(path: string) {
  selfWriteTimestamps.set(path, Date.now());
}

function isRecentSelfWrite(path: string): boolean {
  const last = selfWriteTimestamps.get(path);
  return last !== undefined && Date.now() - last < SELF_WRITE_IGNORE_MS;
}
```

Hook into the lifecycle:

| Action | Watcher change | Self-write mark |
|---|---|---|
| `openFile(path)` (new session) | `watchFile(path)` | — |
| `closeSession(id)` end | `unwatchFile(path)` if `path` is set | — |
| `saveActiveFile` | — | `markSelfWrite(path)` after `writeMarkdownFile` |
| Autosave callback in `getAutosaveQueue()` | — | `markSelfWrite(session.path)` after `writeMarkdownFile` |
| `saveAsDialog` | `unwatchFile(oldPath)` (if any) → `watchFile(newPath)` | `markSelfWrite(newPath)` after write |
| `retargetSessionPath(old, new)` | `unwatchFile(old)` → `watchFile(new)` | — |

Extend `refreshSessionFromDisk` to take an optional `force` flag, so a confirmed reload can bypass the dirty guard:

```ts
async refreshSessionFromDisk(path: string, force = false) {
  const session = this.sessions.find(item => item.path === path || item.id === path);
  if (!session) return false;
  if (!force && session.isDirty()) return false;

  const { content } = await readMarkdownFile(path);
  session.markSaved(content);
  this.sessions = [...this.sessions];
  return true;
}
```

The reconciler is a new store action `handleExternalFileChange(payload)`:

```ts
async handleExternalFileChange(payload: { path: string; kind: "modified" | "removed" }) {
  if (isRecentSelfWrite(payload.path)) return;
  const session = this.sessions.find(s => s.path === payload.path);
  if (!session) return;

  if (payload.kind === "removed") {
    session.markMissing(true);  // see Session changes below
    this.sessions = [...this.sessions];
    return;
  }

  // kind === "modified"
  if (!session.isDirty()) {
    await this.refreshSessionFromDisk(payload.path);
    return;
  }

  const action = await promptExternalChange(sessionLabel(session));
  if (action === "reload") {
    await this.refreshSessionFromDisk(payload.path, true);
  }
  // "keep" or "cancel" → do nothing; next save will overwrite the external version.
}
```

### Session changes (`src/lib/document-session.ts`)

Add a `missing` flag to track externally-deleted files:

```ts
let missing = false;
return {
  // ...existing fields
  isMissing() { return missing; },
  markMissing(value: boolean) { missing = value; },
};
```

`markSaved` and `updateContent` reset `missing = false` (the file is back). Tab labels can read `session.isMissing()` to render a "(missing)" suffix; that UI affordance is not in scope of this spec but the data is exposed for a follow-up.

### Conflict prompt (`src/lib/external-change-prompt.ts`)

New module mirroring `unsaved-prompt.ts`. Tauri's `ask` returns boolean, so two sequential prompts produce three outcomes:

```ts
export type ExternalChangeAction = "reload" | "keep" | "cancel";

export async function promptExternalChange(fileName: string): Promise<ExternalChangeAction> {
  if (!isTauri()) {
    // e2e: default to keep so tests stay deterministic.
    return "keep";
  }

  const reload = await ask(
    `"${fileName}" was modified by another program. Reload from disk and discard your local changes?`,
    { title: "File Changed Externally", kind: "warning" }
  );
  if (reload) return "reload";

  const keep = await ask(
    `Keep your unsaved version of "${fileName}"? Saving later will overwrite the external changes.`,
    { title: "Keep Local Version", kind: "warning" }
  );
  return keep ? "keep" : "cancel";
}
```

i18n strings are hardcoded English in this prompt module, mirroring the existing `unsaved-prompt.ts` pattern. (Following that established convention; i18n migration for both prompts is a separate concern.)

### AppShell wiring (`src/layout/AppShell.vue`)

In `onMounted`, after the existing `onWorkspaceChanged` registration:

```ts
stopFileChangeWatch = await onFileChanged((payload) => {
  void documents.handleExternalFileChange(payload);
});
```

Cleaned up in `onBeforeUnmount` alongside the other `unlisten` handles.

### Cursor preservation on silent reload

`refreshSessionFromDisk` currently calls `session.markSaved(content)` then triggers the `documents.sessions` reactivity, which in turn fires `EditorView.vue`'s `syncViewFromSession`. That function rebuilds the entire `EditorState`, which loses cursor position.

Update `syncViewFromSession` to capture the current selection's `from` line/column before rebuilding, then map onto the new doc:

1. Read `view.state.selection.from`, resolve to `{ line, ch }` via the doc's text.
2. Build the new state.
3. Resolve `{ line, ch }` against the new doc, clamping to `doc.content.size` if past end-of-file. Set selection to the resulting position.
4. Restore scroll position by calling `view.dispatch(tr.scrollIntoView())` only when the cursor is now off-screen; otherwise leave scroll untouched.

This is a localized change inside `syncViewFromSession`; no callers change.

---

## Data Flow

```text
External tool writes file
        ↓
notify (RecommendedWatcher)
        ↓ Modify event
file_watch.rs debounces 100ms
        ↓ emit "file://changed" {path, kind}
AppShell onFileChanged listener
        ↓
documents.handleExternalFileChange(payload)
        ├── isRecentSelfWrite? → drop
        ├── kind === "removed"? → session.markMissing(true)
        ├── !isDirty? → refreshSessionFromDisk(path)
        └── isDirty? → promptExternalChange → reload | keep | cancel
                                                  ↓
                                          refreshSessionFromDisk(path)
                                                  ↓
                                          session.markSaved(newContent)
                                                  ↓
                                          documents.sessions = [...]
                                                  ↓
                                          EditorView.syncViewFromSession (with cursor preservation)
```

---

## Edge Cases

- **App's own save bouncing back as external change** → `selfWriteTimestamps` map; `SELF_WRITE_IGNORE_MS = 500`. Both manual `saveActiveFile` and the autosave queue mark their writes.
- **Atomic-rename saves (vim, VS Code on some platforms)** → notify on macOS uses FSEvents and reports a single `Modify` for FSEvents-coalesced events. On Linux/Windows, sequences like `Remove` followed by `Create` of the same path within the 100 ms debounce window collapse per the resolution rule above (existence check at flush time): the path exists, so the emission is `"modified"`.
- **File deleted externally** → emit `"removed"`, set `session.markMissing(true)`. Tab content stays in memory; the user can save to recreate the file. (Visible "(missing)" indicator on the tab is left for a follow-up; data is exposed.)
- **File replaced via rename of a different file onto our path** → notify reports as a Create event; treated as `"modified"` and reloaded normally.
- **Two sessions on the same path** → cannot happen: `documents.openFile` already de-dupes on path, and session id equals path for file-backed sessions.
- **`saveAsDialog` to a path that's already open in another session** → existing code in `saveAsDialog` does not handle this, and this spec does not change that. The new watcher registration is idempotent (`HashSet`), so we won't double-register.
- **Untitled sessions (`session.path === ""`)** → never registered (the lifecycle table only triggers `watchFile` for non-empty paths). After `saveAsDialog` resolves the path, registration happens.
- **Path normalization** → all `watch_file` / `unwatch_file` arguments must come from `normalizeFilePath` to match how sessions key themselves; the frontend already normalizes paths from dialogs and drag-drop, so reuse that.
- **Watcher initialization failure** → `watch_file` returns `Err` to the frontend; the frontend logs to console and continues. The session still works; it just won't react to external changes. No user-facing toast — failure is rare and would be noisy.

---

## Testing

**Manual (primary):**

1. Open a single file without a folder workspace. From a terminal, run `echo "added line" >> /path/to/file.md`. Editor updates within ~200 ms.
2. Open file, type unsaved changes, then run the same `echo`. Conflict dialog appears with three choices; verify each path:
   - **Reload** → buffer matches disk, dirty cleared.
   - **Keep** → buffer unchanged, still dirty; subsequent Cmd+S overwrites the external content.
   - **Cancel** → same as Keep but dialog dismissed without commitment.
3. Save the file from the app (Cmd+S). Watch console — no `file://changed` event should be processed for ~500 ms (self-write window).
4. Open a file outside the active workspace folder. External modify still triggers reload.
5. Delete the file externally. Verify `session.isMissing()` becomes true (inspect via Vue devtools); content stays. Save to recreate.
6. Atomic-save test with `vim`: open in app, then `vim file.md` → `:wq`. Single reload, no flicker.
7. Cursor preservation: place cursor mid-document, append text externally to end-of-file, verify cursor stays on the same logical line.

**Unit (Rust):**

A test in `src-tauri/src/workspace/file_watch.rs` (using `tempfile`) that:

1. Creates `FileWatchState`, calls `watch_file` on a temp file.
2. Modifies the file, asserts that an event is delivered to a test channel within 500 ms.
3. Calls `unwatch_file`, modifies again, asserts no event.

Tauri event emission is not unit-tested directly; the integration test runs through the manual checklist above.

---

## File List

**New:**
- `src-tauri/src/workspace/file_watch.rs`
- `src/lib/file-watch.ts`
- `src/lib/external-change-prompt.ts`

**Modified:**
- `src-tauri/src/main.rs` — register `FileWatchState` and the two commands
- `src-tauri/src/workspace/mod.rs` — export `file_watch`
- `src-tauri/Cargo.toml` — no new deps (notify already present)
- `src/lib/document-session.ts` — add `isMissing` / `markMissing`
- `src/stores/documents.ts` — lifecycle hooks, `handleExternalFileChange`, self-write timestamps
- `src/layout/AppShell.vue` — register `onFileChanged`, cleanup
- `src/editor/EditorView.vue` — cursor preservation in `syncViewFromSession`

---

## Out of Scope

- Visible "(missing)" badge on tabs for externally deleted files (data is exposed; UI is a follow-up).
- A custom in-app non-modal banner instead of native `ask` dialogs (deferred; native is consistent with the rest of the app).
- Folder workspace tree refresh — still driven by the existing `workspace://changed` event; this spec does not touch that pipeline.
- Multi-cursor / selection-range preservation across reload — only the primary cursor's `from` is mapped; selections collapse to a single cursor on external reload, which matches Typora.
