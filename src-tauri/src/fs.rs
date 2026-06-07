use std::fs;
use std::path::PathBuf;

#[tauri::command]
pub fn read_markdown_file(path: String) -> Result<String, String> {
    fs::read_to_string(PathBuf::from(path)).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn write_markdown_file(path: String, content: String) -> Result<(), String> {
    fs::write(PathBuf::from(path), content).map_err(|err| err.to_string())
}
