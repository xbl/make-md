mod ai;
mod fs;
mod i18n;
mod menu;
mod pdf;
mod recent;
mod recovery;
mod workspace;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(workspace::file_watch::FileWatchState::default())
        .setup(|app| {
            menu::install_menu(app)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event);
        })
        .invoke_handler(tauri::generate_handler![
            ai::save_api_key,
            ai::load_api_key,
            ai::fetch_url::fetch_url,
            i18n::get_system_locale,
            fs::read_markdown_file,
            fs::read_binary_file,
            fs::write_markdown_file,
            fs::write_binary_file,
            fs::pick_save_word_file,
            menu::sync_menu_locale,
            recent::load_recent_files,
            recent::save_recent_file,
            recent::remove_recent_file,
            recent::clear_recent_files,
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
            workspace::file_watch::watch_file,
            workspace::file_watch::unwatch_file,
            pdf::export_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("failed to run make-md");
}
