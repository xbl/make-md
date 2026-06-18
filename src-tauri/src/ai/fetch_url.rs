use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FetchUrlResponse {
    pub status: u16,
    pub body: String,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn fetch_url(url: String) -> Result<FetchUrlResponse, String> {
    let client = reqwest::Client::builder()
        .user_agent("make-md/0.1")
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let body = resp.text().await.unwrap_or_default();

    Ok(FetchUrlResponse {
        status,
        body,
        error: if status >= 400 {
            Some(format!("HTTP {}", status))
        } else {
            None
        },
    })
}
