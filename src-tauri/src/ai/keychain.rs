use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

pub const KEYCHAIN_SERVICE: &str = "make-md";

pub fn provider_account(provider: &str) -> String {
    format!("ai-key:{provider}")
}

fn config_path(app: &tauri::AppHandle) -> PathBuf {
    app.path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("ai-keys.json")
}

fn load_config(app: &tauri::AppHandle) -> HashMap<String, String> {
    let path = config_path(app);
    match fs::read_to_string(&path) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => HashMap::new(),
    }
}

fn save_config(app: &tauri::AppHandle, config: &HashMap<String, String>) -> Result<(), String> {
    let path = config_path(app);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

pub fn save_api_key(
    app: tauri::AppHandle,
    provider: String,
    api_key: String,
) -> Result<(), String> {
    // File-based storage (primary — always works, no permission prompts)
    let mut config = load_config(&app);
    config.insert(provider.clone(), api_key.clone());
    save_config(&app, &config)?;

    // Keychain (best-effort — may fail on unsigned dev builds)
    let _ = keyring::Entry::new(KEYCHAIN_SERVICE, &provider_account(&provider))
        .and_then(|entry| entry.set_password(&api_key));

    Ok(())
}

pub fn load_api_key(
    app: tauri::AppHandle,
    provider: String,
) -> Result<Option<String>, String> {
    // Try keychain first
    if let Ok(entry) = keyring::Entry::new(KEYCHAIN_SERVICE, &provider_account(&provider)) {
        if let Ok(value) = entry.get_password() {
            return Ok(Some(value));
        }
    }

    // Fall back to file-based config
    let config = load_config(&app);
    Ok(config.get(&provider).cloned())
}

#[cfg(test)]
mod keychain_tests {
    use super::*;

    #[test]
    fn key_ref_uses_provider_account_name() {
        let account = provider_account("openai");
        assert_eq!(account, "ai-key:openai");
    }
}
