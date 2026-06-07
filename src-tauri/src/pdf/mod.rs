use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn write_temp_html(html: &str) -> Result<PathBuf, String> {
    let path = std::env::temp_dir().join(format!(
        "make-md-export-{}.html",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|value| value.as_millis())
            .unwrap_or(0)
    ));
    fs::write(&path, html).map_err(|err| err.to_string())?;
    Ok(path)
}

#[cfg(target_os = "macos")]
fn export_with_headless_chrome(html_path: &Path, output_path: &Path) -> Result<(), String> {
    let chrome_paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ];

    for chrome in chrome_paths {
        if !Path::new(chrome).exists() {
            continue;
        }

        let status = Command::new(chrome)
            .args([
                "--headless=new",
                "--disable-gpu",
                "--no-sandbox",
                &format!("--print-to-pdf={}", output_path.display()),
                &format!("file://{}", html_path.display()),
            ])
            .status()
            .map_err(|err| err.to_string())?;

        if status.success() && output_path.exists() {
            return Ok(());
        }
    }

    Err("Could not generate PDF with the built-in renderer. Install Google Chrome or use HTML export (⌘E).".into())
}

#[cfg(not(target_os = "macos"))]
fn export_with_headless_chrome(_html_path: &Path, _output_path: &Path) -> Result<(), String> {
    Err("PDF export is currently supported on macOS only. Use HTML export (⌘E) instead.".into())
}

#[tauri::command]
pub fn export_pdf(html: String, output_path: String) -> Result<(), String> {
    let temp_html = write_temp_html(&html)?;
    let output = PathBuf::from(output_path);
    let result = export_with_headless_chrome(&temp_html, &output);
    let _ = fs::remove_file(temp_html);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_temp_html_file() {
        let path = write_temp_html("<html><body>Hi</body></html>").unwrap();
        assert!(path.exists());
        let _ = fs::remove_file(path);
    }
}
