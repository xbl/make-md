use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[tauri::command]
pub fn create_file(parent: String, name: String) -> Result<String, String> {
    let mut file_name = name;
    if !file_name.ends_with(".md") && !file_name.ends_with(".markdown") {
        file_name.push_str(".md");
    }
    let path = PathBuf::from(&parent).join(&file_name);
    if path.exists() {
        return Err(format!("File already exists: {}", path.display()));
    }
    if let Some(parent_dir) = path.parent() {
        fs::create_dir_all(parent_dir).map_err(|err| err.to_string())?;
    }
    fs::write(&path, "").map_err(|err| err.to_string())?;
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
    fs::rename(&src, &dst).map_err(|err| err.to_string())?;
    Ok(dst.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_file(path: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {path}"));
    }
    let extension = file_path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if extension != "md" && extension != "markdown" {
        return Err("Only markdown files can be deleted".into());
    }
    fs::remove_file(file_path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn move_file(from: String, to_dir: String) -> Result<String, String> {
    let src = PathBuf::from(&from);
    let file_name = src
        .file_name()
        .ok_or_else(|| "Invalid source path".to_string())?;
    let dst = PathBuf::from(&to_dir).join(file_name);
    if dst.exists() {
        return Err(format!("Target already exists: {}", dst.display()));
    }
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    fs::rename(&src, &dst).map_err(|err| err.to_string())?;
    Ok(dst.to_string_lossy().to_string())
}

#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);
    if !file_path.exists() {
        return Err(format!("Path not found: {path}"));
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg("-R")
            .arg(&path)
            .status()
            .map_err(|err| err.to_string())?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(format!("/select,{path}"))
            .status()
            .map_err(|err| err.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        let parent = file_path.parent().unwrap_or(file_path);
        Command::new("xdg-open")
            .arg(parent)
            .status()
            .map_err(|err| err.to_string())?;
    }

    Ok(())
}
