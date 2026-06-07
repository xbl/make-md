use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

fn assets_dir_for_doc(doc_path: &str) -> Result<PathBuf, String> {
    let doc = PathBuf::from(doc_path);
    let parent = doc.parent().ok_or("Document has no parent directory")?;
    Ok(parent.join("assets"))
}

fn build_asset_filename(original: &str, ext: &str) -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis())
        .unwrap_or(0);
    format!("{ts}-{original}.{ext}")
}

fn relative_asset_path(doc_path: &str, asset_path: &Path) -> Result<String, String> {
    let doc = PathBuf::from(doc_path);
    let parent = doc.parent().ok_or("Document has no parent directory")?;
    let relative = asset_path
        .strip_prefix(parent)
        .map_err(|err| err.to_string())?;
    Ok(format!("./{}", relative.to_string_lossy().replace('\\', "/")))
}

#[tauri::command]
pub fn copy_image_asset(doc_path: String, source_path: String) -> Result<String, String> {
    let assets_dir = assets_dir_for_doc(&doc_path)?;
    fs::create_dir_all(&assets_dir).map_err(|err| err.to_string())?;

    let source = PathBuf::from(&source_path);
    let ext = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("png");
    let original = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("image");
    let dest = assets_dir.join(build_asset_filename(original, ext));
    fs::copy(&source, &dest).map_err(|err| err.to_string())?;
    relative_asset_path(&doc_path, &dest)
}

#[tauri::command]
pub fn copy_image_bytes(doc_path: String, bytes: Vec<u8>, ext: String) -> Result<String, String> {
    let assets_dir = assets_dir_for_doc(&doc_path)?;
    fs::create_dir_all(&assets_dir).map_err(|err| err.to_string())?;
    let extension = if ext.is_empty() { "png".to_string() } else { ext };
    let dest = assets_dir.join(build_asset_filename("paste", &extension));
    fs::write(&dest, bytes).map_err(|err| err.to_string())?;
    relative_asset_path(&doc_path, &dest)
}
