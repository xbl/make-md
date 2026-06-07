#[tauri::command]
pub fn workspace_name() -> String {
    "Default Workspace".to_string()
}
