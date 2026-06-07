use std::collections::VecDeque;
use std::fs;
use std::path::PathBuf;

use tauri::{path::BaseDirectory, Manager};

const MAX_RECENT: usize = 10;

fn recent_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .resolve("recent.json", BaseDirectory::AppLocalData)
        .map_err(|err| err.to_string())?;
    if let Some(parent) = dir.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    Ok(dir)
}

#[tauri::command]
pub fn load_recent_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = recent_file_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    Ok(serde_json::from_str(&raw).map_err(|err| err.to_string())?)
}

#[tauri::command]
pub fn save_recent_file(app: tauri::AppHandle, path: String) -> Result<Vec<String>, String> {
    let mut recent = VecDeque::from(load_recent_files(app.clone())?);
    recent.retain(|item| item != &path);
    recent.push_front(path);
    while recent.len() > MAX_RECENT {
        recent.pop_back();
    }
    let items: Vec<String> = recent.into_iter().collect();
    fs::write(
        recent_file_path(&app)?,
        serde_json::to_string_pretty(&items).unwrap(),
    )
    .map_err(|err| err.to_string())?;
    Ok(items)
}
