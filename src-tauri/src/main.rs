mod fs;
mod recent;
mod recovery;
mod workspace;

fn main() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
      fs::read_markdown_file,
      fs::write_markdown_file,
      recent::load_recent_files,
      recent::save_recent_file,
      recovery::save_recovery_snapshot,
      recovery::load_recovery_snapshot,
      recovery::clear_recovery_snapshot,
      workspace::workspace_name
    ])
    .run(tauri::generate_context!())
    .expect("failed to run make-md");
}
