use std::collections::HashSet;
use std::sync::{Mutex, OnceLock};

use serde_json::json;
use tauri::Emitter;

use crate::ai::keychain::load_api_key;
use crate::ai::providers::ProviderConfig;
use crate::ai::AiStreamRequest;

fn cancelled_requests() -> &'static Mutex<HashSet<String>> {
    static CANCELLED: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    CANCELLED.get_or_init(|| Mutex::new(HashSet::new()))
}

pub async fn start_stream(app: tauri::AppHandle, request: AiStreamRequest) -> Result<(), String> {
    let provider = ProviderConfig::from_name(&request.provider)
        .ok_or_else(|| "unknown provider".to_string())?;
    let _api_key = load_api_key(&request.provider)?.ok_or_else(|| "missing api key".to_string())?;

    let done_event = format!("ai://done/{}", request.request_id);
    app.emit(
        &done_event,
        json!({
            "provider": provider.name,
            "usage": null
        }),
    )
    .map_err(|err| err.to_string())?;

    Ok(())
}

pub fn cancel_stream(request_id: &str) -> Result<(), String> {
    cancelled_requests()
        .lock()
        .map_err(|_| "cancel lock poisoned".to_string())?
        .insert(request_id.to_string());
    Ok(())
}
