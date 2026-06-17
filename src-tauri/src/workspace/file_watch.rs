use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};

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
        // On macOS /var is a symlink to /private/var; notify returns canonical paths.
        let expected = path.canonicalize().unwrap_or_else(|_| path.clone());
        assert_eq!(payload.path, expected.to_string_lossy());
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
