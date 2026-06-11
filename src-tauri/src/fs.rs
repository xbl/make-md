use std::fs;
use std::path::PathBuf;
use std::sync::mpsc;

use serde::Serialize;

#[tauri::command]
pub fn read_markdown_file(path: String) -> Result<String, String> {
    fs::read_to_string(PathBuf::from(path)).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn write_markdown_file(path: String, content: String) -> Result<(), String> {
    fs::write(PathBuf::from(path), content).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    fs::write(PathBuf::from(path), bytes).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn read_binary_file(path: String) -> Result<Vec<u8>, String> {
    fs::read(PathBuf::from(path)).map_err(|err| err.to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWordSelection {
    path: String,
    include_mermaid_code: bool,
}

fn split_default_save_path(default_path: &str) -> (Option<String>, Option<String>) {
    let path = PathBuf::from(default_path);
    let directory = path.parent().and_then(|parent| {
        let text = parent.to_string_lossy().trim().to_string();
        if text.is_empty() || text == "." {
            None
        } else {
            Some(text)
        }
    });
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .map(|value| value.to_string());
    (directory, file_name)
}

#[cfg(target_os = "macos")]
fn show_word_save_panel(default_path: Option<String>) -> Result<Option<SaveWordSelection>, String> {
    use objc2::{MainThreadMarker, MainThreadOnly};
    use objc2_app_kit::{
        NSButton, NSControlStateValueOff, NSControlStateValueOn, NSModalResponseOK, NSSavePanel, NSView,
    };
    use objc2_foundation::{NSPoint, NSRect, NSSize, NSString, NSURL};

    let mtm = MainThreadMarker::new().ok_or_else(|| "Word export save panel requires main thread".to_string())?;
    let panel = NSSavePanel::savePanel(mtm);
    panel.setCanCreateDirectories(true);

    if let Some(default_path) = default_path {
        let (directory, file_name) = split_default_save_path(&default_path);
        if let Some(parent_string) = directory {
            let parent_ns = NSString::from_str(&parent_string);
            let parent_url = NSURL::fileURLWithPath(&parent_ns);
            panel.setDirectoryURL(Some(&parent_url));
        }
        if let Some(file_name) = file_name {
            let file_name_ns = NSString::from_str(&file_name);
            panel.setNameFieldStringValue(&file_name_ns);
        }
    }

    let accessory_frame = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(280.0, 24.0));
    let accessory_view = NSView::initWithFrame(NSView::alloc(mtm), accessory_frame);
    let checkbox = unsafe {
        NSButton::checkboxWithTitle_target_action(&NSString::from_str("导出 mermaid 代码"), None, None, mtm)
    };
    checkbox.setState(NSControlStateValueOff);
    checkbox.setFrameOrigin(NSPoint::new(0.0, 0.0));
    checkbox.setFrameSize(NSSize::new(260.0, 24.0));
    accessory_view.addSubview(&checkbox);
    panel.setAccessoryView(Some(&accessory_view));

    let response = panel.runModal();
    if response != NSModalResponseOK {
        return Ok(None);
    }

    let url = panel.URL().ok_or_else(|| "Save panel did not return a file path".to_string())?;
    let path = url
        .path()
        .ok_or_else(|| "Save panel returned an invalid file path".to_string())?
        .to_string();

    Ok(Some(SaveWordSelection {
        path,
        include_mermaid_code: checkbox.state() == NSControlStateValueOn,
    }))
}

#[cfg(target_os = "macos")]
#[tauri::command]
pub fn pick_save_word_file(
    app: tauri::AppHandle,
    default_path: Option<String>,
) -> Result<Option<SaveWordSelection>, String> {
    let (tx, rx) = mpsc::channel();
    app.run_on_main_thread(move || {
        let result = show_word_save_panel(default_path);
        let _ = tx.send(result);
    })
    .map_err(|err| err.to_string())?;

    rx.recv()
        .map_err(|err| format!("Failed to receive save panel result: {err}"))?
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn pick_save_word_file(_default_path: Option<String>) -> Result<Option<SaveWordSelection>, String> {
    Err("Word export with Mermaid option is currently supported on macOS only.".into())
}

#[cfg(test)]
mod tests {
    use super::split_default_save_path;

    #[test]
    fn split_default_save_path_ignores_empty_parent_for_relative_name() {
        let (directory, file_name) = split_default_save_path("untitled.docx");
        assert_eq!(directory, None);
        assert_eq!(file_name.as_deref(), Some("untitled.docx"));
    }

    #[test]
    fn split_default_save_path_keeps_absolute_parent() {
        let (directory, file_name) = split_default_save_path("/tmp/demo.docx");
        assert_eq!(directory.as_deref(), Some("/tmp"));
        assert_eq!(file_name.as_deref(), Some("demo.docx"));
    }
}
