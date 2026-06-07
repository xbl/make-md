use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use tauri::{path::BaseDirectory, Manager};

fn recovery_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .resolve("recovery", BaseDirectory::AppLocalData)
        .map_err(|err| err.to_string())?;
    fs::create_dir_all(&dir).map_err(|err| err.to_string())?;
    Ok(dir)
}

fn snapshot_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    let safe_name = id.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    Ok(recovery_dir(app)?.join(format!("{}.json", safe_name)))
}

#[tauri::command]
pub fn save_recovery_snapshot(
    app: tauri::AppHandle,
    id: String,
    content: String,
) -> Result<(), String> {
    let path = snapshot_path(&app, &id)?;
    let data = serde_json::json!({ "id": id, "content": content });
    fs::write(path, serde_json::to_string_pretty(&data).unwrap()).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn load_recovery_snapshot(app: tauri::AppHandle, id: String) -> Result<Option<String>, String> {
    let path = snapshot_path(&app, &id)?;
    if !path.exists() {
        return Ok(None);
    }
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let parsed: HashMap<String, serde_json::Value> =
        serde_json::from_str(&raw).map_err(|err| err.to_string())?;
    Ok(parsed
        .get("content")
        .and_then(|v| v.as_str())
        .map(String::from))
}

#[tauri::command]
pub fn clear_recovery_snapshot(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let path = snapshot_path(&app, &id)?;
    if path.exists() {
        fs::remove_file(path).map_err(|err| err.to_string())?;
    }
    Ok(())
}
