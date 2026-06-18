pub mod fetch_url;
pub mod keychain;
pub mod providers;

#[tauri::command]
pub fn save_api_key(provider: String, api_key: String) -> Result<(), String> {
    keychain::save_api_key(&provider, &api_key)
}

#[tauri::command]
pub fn load_api_key(provider: String) -> Result<Option<String>, String> {
    keychain::load_api_key(&provider)
}
