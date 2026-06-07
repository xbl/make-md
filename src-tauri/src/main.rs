mod fs;
mod recent;
mod recovery;
mod workspace;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            fs::read_markdown_file,
            fs::write_markdown_file,
            recent::load_recent_files,
            recent::save_recent_file,
            recovery::save_recovery_snapshot,
            recovery::load_recovery_snapshot,
            recovery::clear_recovery_snapshot,
            workspace::tree::list_markdown_tree,
            workspace::watch::watch_folder,
            workspace::files::create_file,
            workspace::files::rename_file,
            workspace::files::delete_file,
            workspace::files::move_file,
            workspace::files::reveal_in_finder,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run make-md");
}
