use serde::{Deserialize, Serialize};

pub mod keychain;
pub mod providers;
pub mod stream;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiStreamRequest {
    pub request_id: String,
    pub provider: String,
    pub model: String,
    pub messages: Vec<AiMessage>,
}

#[tauri::command]
pub async fn ai_stream(app: tauri::AppHandle, request: AiStreamRequest) -> Result<(), String> {
    stream::start_stream(app, request).await
}

#[tauri::command]
pub fn ai_cancel(request_id: String) -> Result<(), String> {
    stream::cancel_stream(&request_id)
}

#[tauri::command]
pub fn save_api_key(provider: String, api_key: String) -> Result<(), String> {
    keychain::save_api_key(&provider, &api_key)
}

#[tauri::command]
pub fn load_api_key(provider: String) -> Result<Option<String>, String> {
    keychain::load_api_key(&provider)
}
