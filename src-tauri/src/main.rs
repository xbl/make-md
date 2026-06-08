mod ai;
mod fs;
mod menu;
mod pdf;
mod recent;
mod recovery;
mod workspace;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            menu::install_menu(app)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event);
        })
        .invoke_handler(tauri::generate_handler![
            ai::ai_stream,
            ai::ai_cancel,
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
            workspace::assets::copy_image_asset,
            workspace::assets::copy_image_bytes,
            pdf::export_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run make-md");
}
