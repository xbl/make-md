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

pub fn remove_recent_path(recent: Vec<String>, path: String) -> Vec<String> {
    recent.into_iter().filter(|item| item != &path).collect()
}

pub fn clear_recent_paths(_recent: Vec<String>) -> Vec<String> {
    Vec::new()
}

fn save_recent_files(app: &tauri::AppHandle, recent: &[String]) -> Result<(), String> {
    fs::write(
        recent_file_path(app)?,
        serde_json::to_string_pretty(recent).map_err(|err| err.to_string())?,
    )
    .map_err(|err| err.to_string())
}

pub fn filter_existing_paths(paths: Vec<String>) -> (Vec<String>, bool) {
    let mut existing = Vec::new();
    let mut changed = false;
    for path in paths {
        if std::path::Path::new(&path).exists() {
            existing.push(path);
        } else {
            changed = true;
        }
    }
    (existing, changed)
}

#[tauri::command]
pub fn load_recent_files(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let path = recent_file_path(&app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let raw = fs::read_to_string(path).map_err(|err| err.to_string())?;
    let files: Vec<String> = serde_json::from_str(&raw).map_err(|err| err.to_string())?;
    
    let (existing, changed) = filter_existing_paths(files);
    
    if changed {
        save_recent_files(&app, &existing)?;
    }
    
    Ok(existing)
}

#[tauri::command]
pub fn save_recent_file(app: tauri::AppHandle, path: String) -> Result<Vec<String>, String> {
    let recent = load_recent_files(app.clone())?;
    let next = add_recent_path(recent, path, MAX_RECENT);
    save_recent_files(&app, &next)?;
    Ok(next)
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

#[cfg(test)]
mod tests {
    use super::{add_recent_path, clear_recent_paths, remove_recent_path};

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

    #[test]
    fn filters_out_non_existent_paths() {
        use super::filter_existing_paths;
        use std::fs::File;

        // Create a temporary file to guarantee it exists
        let temp_dir = std::env::temp_dir();
        let temp_file_path = temp_dir.join("make_md_temp_test_recent_file.md");
        let _file = File::create(&temp_file_path).unwrap();
        let temp_file_str = temp_file_path.to_string_lossy().into_owned();

        let paths = vec![
            temp_file_str.clone(),
            "/this/path/does/not/exist/at/all/12345.md".to_string(),
        ];

        let (filtered, changed) = filter_existing_paths(paths);
        
        // Clean up temp file
        let _ = std::fs::remove_file(temp_file_path);

        assert!(changed);
        assert_eq!(filtered, vec![temp_file_str]);
    }
}
