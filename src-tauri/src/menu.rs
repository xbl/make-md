use crate::i18n::{menu_label, DEFAULT_LOCALE};
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{App, AppHandle, Emitter, Runtime};

pub const MENU_EVENT_NAME: &str = "app://menu-command";

const COMMANDS: &[(&str, &str, &str, bool, Option<&str>)] = &[
    ("file.new", "menu.file.new", "file", true, Some("CmdOrCtrl+N")),
    ("file.open", "menu.file.open", "file", true, Some("CmdOrCtrl+O")),
    ("file.openFolder", "menu.file.openFolder", "file", true, Some("CmdOrCtrl+Shift+O")),
    ("file.save", "menu.file.save", "file", true, Some("CmdOrCtrl+S")),
    ("file.saveAs", "menu.file.saveAs", "file", true, Some("CmdOrCtrl+Shift+S")),
    ("file.close", "menu.file.close", "file", true, Some("CmdOrCtrl+W")),
    ("app.preferences", "menu.app.preferences", "file", true, Some("CmdOrCtrl+,")),
    ("edit.find", "menu.edit.find", "edit", true, Some("CmdOrCtrl+F")),
    ("edit.replace", "menu.edit.replace", "edit", true, Some("CmdOrCtrl+Alt+F")),
    ("edit.findNext", "menu.edit.findNext", "edit", true, Some("CmdOrCtrl+G")),
    ("edit.findPrevious", "menu.edit.findPrevious", "edit", true, Some("CmdOrCtrl+Shift+G")),
    ("edit.selectAll", "menu.edit.selectAll", "edit", true, Some("CmdOrCtrl+A")),
    ("format.bold", "menu.format.bold", "format", true, Some("CmdOrCtrl+B")),
    ("format.italic", "menu.format.italic", "format", true, Some("CmdOrCtrl+I")),
    ("format.underline", "menu.format.underline", "format", false, Some("CmdOrCtrl+U")),
    ("format.inlineCode", "menu.format.inlineCode", "format", true, Some("CmdOrCtrl+Shift+`")),
    ("format.strike", "menu.format.strike", "format", true, Some("Ctrl+Shift+`")),
    ("format.link", "menu.format.link", "format", true, Some("CmdOrCtrl+K")),
    ("format.image", "menu.format.image", "format", true, Some("CmdOrCtrl+Ctrl+I")),
    ("format.clear", "menu.format.clear", "format", true, Some("CmdOrCtrl+\\")),
    ("paragraph.h1", "menu.paragraph.h1", "paragraph", true, Some("CmdOrCtrl+1")),
    ("paragraph.h2", "menu.paragraph.h2", "paragraph", true, Some("CmdOrCtrl+2")),
    ("paragraph.h3", "menu.paragraph.h3", "paragraph", true, Some("CmdOrCtrl+3")),
    ("paragraph.h4", "menu.paragraph.h4", "paragraph", true, Some("CmdOrCtrl+4")),
    ("paragraph.h5", "menu.paragraph.h5", "paragraph", true, Some("CmdOrCtrl+5")),
    ("paragraph.h6", "menu.paragraph.h6", "paragraph", true, Some("CmdOrCtrl+6")),
    ("paragraph.paragraph", "menu.paragraph.paragraph", "paragraph", true, Some("CmdOrCtrl+0")),
    ("paragraph.increaseHeading", "menu.paragraph.increaseHeading", "paragraph", true, Some("CmdOrCtrl+=")),
    ("paragraph.decreaseHeading", "menu.paragraph.decreaseHeading", "paragraph", true, Some("CmdOrCtrl+-")),
    ("paragraph.quote", "menu.paragraph.quote", "paragraph", true, Some("CmdOrCtrl+Alt+Q")),
    ("paragraph.orderedList", "menu.paragraph.orderedList", "paragraph", true, Some("CmdOrCtrl+Alt+O")),
    ("paragraph.unorderedList", "menu.paragraph.unorderedList", "paragraph", true, Some("CmdOrCtrl+Alt+U")),
    ("paragraph.codeFence", "menu.paragraph.codeFence", "paragraph", true, Some("CmdOrCtrl+Alt+C")),
    ("paragraph.table", "menu.paragraph.table", "paragraph", true, Some("CmdOrCtrl+Alt+T")),
    ("view.sidebar", "menu.view.sidebar", "view", true, Some("CmdOrCtrl+Shift+L")),
    ("view.outline", "menu.view.outline", "view", true, Some("CmdOrCtrl+Ctrl+1")),
    ("view.files", "menu.view.files", "view", true, Some("CmdOrCtrl+Ctrl+3")),
    ("view.focus", "menu.view.focus", "view", true, Some("F8")),
    ("view.source", "menu.view.source", "view", true, Some("CmdOrCtrl+Alt+S")),
    ("view.commandPalette", "menu.view.commandPalette", "view", true, Some("CmdOrCtrl+Shift+P")),
    ("export.html", "menu.export.html", "export", true, Some("CmdOrCtrl+E")),
    ("export.pdf", "menu.export.pdf", "export", true, Some("CmdOrCtrl+Shift+E")),
    ("export.word", "menu.export.word", "export", true, None),
];

pub fn install_menu<R: Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    let menu = build_menu_for_locale(app.handle(), DEFAULT_LOCALE)?;
    app.set_menu(menu)?;
    Ok(())
}

#[tauri::command]
pub fn sync_menu_locale(app: tauri::AppHandle, locale: String) -> Result<(), String> {
    let menu = build_menu_for_locale(&app, &locale).map_err(|err| err.to_string())?;
    app.set_menu(menu).map_err(|err| err.to_string())?;
    Ok(())
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    let command_id = event.id().0.as_str();
    let _ = app.emit(MENU_EVENT_NAME, command_id);
}

fn build_menu_for_locale<R: Runtime>(app: &AppHandle<R>, locale: &str) -> tauri::Result<Menu<R>> {
    let mut top_level: Vec<Submenu<R>> = Vec::new();

    #[cfg(target_os = "macos")]
    top_level.push(build_app_submenu(app)?);

    for (category, label) in [
        ("file", menu_label(locale, "menu.file")),
        ("edit", menu_label(locale, "menu.edit")),
        ("paragraph", menu_label(locale, "menu.paragraph")),
        ("format", menu_label(locale, "menu.format")),
        ("view", menu_label(locale, "menu.view")),
        ("export", menu_label(locale, "menu.export")),
    ] {
        if category == "edit" {
            top_level.push(build_edit_submenu(app, label, locale)?);
            continue;
        }

        let items = build_command_items(app, category, locale)?;
        let refs: Vec<&dyn tauri::menu::IsMenuItem<R>> =
            items.iter().map(|item| item as &dyn tauri::menu::IsMenuItem<R>).collect();
        top_level.push(Submenu::with_items(app, label, true, &refs)?);
    }

    #[cfg(target_os = "macos")]
    top_level.push(build_window_submenu(app, locale)?);

    let top_refs: Vec<&dyn tauri::menu::IsMenuItem<R>> =
        top_level.iter().map(|submenu| submenu as &dyn tauri::menu::IsMenuItem<R>).collect();
    Menu::with_items(app, &top_refs)
}

#[cfg(target_os = "macos")]
fn build_app_submenu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let pkg_info = app.package_info();
    let config = app.config();
    let about_metadata = AboutMetadata {
        name: Some(pkg_info.name.clone()),
        version: Some(pkg_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config.bundle.publisher.clone().map(|publisher| vec![publisher]),
        ..Default::default()
    };

    Submenu::with_items(
        app,
        pkg_info.name.clone(),
        true,
        &[
            &PredefinedMenuItem::about(app, None, Some(about_metadata))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, None)?,
            &PredefinedMenuItem::hide_others(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, None)?,
        ],
    )
}

#[cfg(target_os = "macos")]
fn build_window_submenu<R: Runtime>(app: &AppHandle<R>, locale: &str) -> tauri::Result<Submenu<R>> {
    Submenu::with_items(
        app,
        menu_label(locale, "menu.window"),
        true,
        &[
            &PredefinedMenuItem::minimize(app, None)?,
            &PredefinedMenuItem::maximize(app, None)?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, None)?,
        ],
    )
}

fn build_command_items<R: Runtime>(
    app: &AppHandle<R>,
    category: &str,
    locale: &str,
) -> tauri::Result<Vec<MenuItem<R>>> {
    COMMANDS
        .iter()
        .filter(|(_, _, item_category, _, _)| *item_category == category)
        .map(|(id, item_key, _, enabled, accelerator)| {
            MenuItem::with_id(app, *id, menu_label(locale, item_key), *enabled, *accelerator)
        })
        .collect()
}

fn build_edit_submenu<R: Runtime>(
    app: &AppHandle<R>,
    label: &str,
    locale: &str,
) -> tauri::Result<Submenu<R>> {
    let edit_commands = build_command_items(app, "edit", locale)?;
    let undo = PredefinedMenuItem::undo(app, None)?;
    let redo = PredefinedMenuItem::redo(app, None)?;
    let separator_1 = PredefinedMenuItem::separator(app)?;
    let cut = PredefinedMenuItem::cut(app, None)?;
    let copy = PredefinedMenuItem::copy(app, None)?;
    let paste = PredefinedMenuItem::paste(app, None)?;
    let select_all = PredefinedMenuItem::select_all(app, None)?;
    let separator_2 = PredefinedMenuItem::separator(app)?;

    let mut refs: Vec<&dyn tauri::menu::IsMenuItem<R>> = vec![
        &undo,
        &redo,
        &separator_1,
        &cut,
        &copy,
        &paste,
        &select_all,
        &separator_2,
    ];
    refs.extend(edit_commands.iter().map(|item| item as &dyn tauri::menu::IsMenuItem<R>));

    Submenu::with_items(app, label, true, &refs)
}
