use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc;
use std::thread;
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub fn watch_folder(app: AppHandle, root: String) -> Result<(), String> {
    let path = Path::new(&root).to_path_buf();
    thread::spawn(move || {
        let (tx, rx) = mpsc::channel();
        let mut watcher = RecommendedWatcher::new(
            move |result| {
                if tx.send(result).is_err() {}
            },
            notify::Config::default(),
        )
        .map_err(|err| err.to_string())
        .expect("watcher");

        if watcher.watch(&path, RecursiveMode::Recursive).is_err() {
            return;
        }

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
