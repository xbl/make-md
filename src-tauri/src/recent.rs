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

pub fn add_recent_path(recent: Vec<String>, path: String, max: usize) -> Vec<String> {
    if recent.iter().any(|item| item == &path) {
        return recent;
    }
    let mut next = recent;
    next.push(path);
    if next.len() > max {
        next.remove(0);
    }
    next
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
    let recent = load_recent_files(app.clone())?;
    let next = add_recent_path(recent, path, MAX_RECENT);
    fs::write(
        recent_file_path(&app)?,
        serde_json::to_string_pretty(&next).unwrap(),
    )
    .map_err(|err| err.to_string())?;
    Ok(next)
}

#[cfg(test)]
mod tests {
    use super::add_recent_path;

    #[test]
    fn keeps_order_when_path_already_exists() {
        let recent = vec!["a.md".into(), "b.md".into(), "c.md".into()];
        let next = add_recent_path(recent.clone(), "b.md".into(), 10);
        assert_eq!(next, recent);
    }

    #[test]
    fn appends_new_paths_without_reordering_existing() {
        let recent = vec!["a.md".into(), "b.md".into()];
        let next = add_recent_path(recent, "c.md".into(), 10);
        assert_eq!(next, vec!["a.md", "b.md", "c.md"]);
    }
}
