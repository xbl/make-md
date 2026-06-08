use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{App, AppHandle, Emitter, Runtime};

pub const MENU_EVENT_NAME: &str = "app://menu-command";

const COMMANDS: &[(&str, &str, &str, bool, Option<&str>)] = &[
    ("file.new", "New File", "file", true, Some("CmdOrCtrl+N")),
    ("file.open", "Open File", "file", true, Some("CmdOrCtrl+O")),
    ("file.openFolder", "Open Folder", "file", true, Some("CmdOrCtrl+Shift+O")),
    ("file.save", "Save", "file", true, Some("CmdOrCtrl+S")),
    ("file.saveAs", "Save As…", "file", true, Some("CmdOrCtrl+Shift+S")),
    ("file.close", "Close Tab", "file", true, Some("CmdOrCtrl+W")),
    ("app.preferences", "Preferences…", "file", true, Some("CmdOrCtrl+,")),
    ("edit.find", "Find", "edit", true, Some("CmdOrCtrl+F")),
    ("edit.replace", "Replace", "edit", true, Some("CmdOrCtrl+Alt+F")),
    ("edit.findNext", "Find Next", "edit", true, Some("CmdOrCtrl+G")),
    ("edit.findPrevious", "Find Previous", "edit", true, Some("CmdOrCtrl+Shift+G")),
    ("edit.selectAll", "Select All", "edit", true, Some("CmdOrCtrl+A")),
    ("format.bold", "Bold", "format", true, Some("CmdOrCtrl+B")),
    ("format.italic", "Italic", "format", true, Some("CmdOrCtrl+I")),
    ("format.underline", "Underline", "format", false, Some("CmdOrCtrl+U")),
    ("format.inlineCode", "Inline Code", "format", true, Some("CmdOrCtrl+Shift+`")),
    ("format.strike", "Strikethrough", "format", true, Some("Ctrl+Shift+`")),
    ("format.link", "Hyperlink", "format", true, Some("CmdOrCtrl+K")),
    ("format.image", "Image", "format", false, Some("CmdOrCtrl+Ctrl+I")),
    ("format.clear", "Clear Formatting", "format", true, Some("CmdOrCtrl+\\")),
    ("paragraph.h1", "Heading 1", "paragraph", true, Some("CmdOrCtrl+1")),
    ("paragraph.h2", "Heading 2", "paragraph", true, Some("CmdOrCtrl+2")),
    ("paragraph.h3", "Heading 3", "paragraph", true, Some("CmdOrCtrl+3")),
    ("paragraph.h4", "Heading 4", "paragraph", true, Some("CmdOrCtrl+4")),
    ("paragraph.h5", "Heading 5", "paragraph", true, Some("CmdOrCtrl+5")),
    ("paragraph.h6", "Heading 6", "paragraph", true, Some("CmdOrCtrl+6")),
    ("paragraph.paragraph", "Paragraph", "paragraph", true, Some("CmdOrCtrl+0")),
    ("paragraph.increaseHeading", "Increase Heading Level", "paragraph", true, Some("CmdOrCtrl+=")),
    ("paragraph.decreaseHeading", "Decrease Heading Level", "paragraph", true, Some("CmdOrCtrl+-")),
    ("paragraph.quote", "Quote", "paragraph", true, Some("CmdOrCtrl+Alt+Q")),
    ("paragraph.orderedList", "Ordered List", "paragraph", true, Some("CmdOrCtrl+Alt+O")),
    ("paragraph.unorderedList", "Unordered List", "paragraph", true, Some("CmdOrCtrl+Alt+U")),
    ("paragraph.codeFence", "Code Fences", "paragraph", true, Some("CmdOrCtrl+Alt+C")),
    ("paragraph.table", "Table", "paragraph", false, Some("CmdOrCtrl+Alt+T")),
    ("view.sidebar", "Toggle Sidebar", "view", true, Some("CmdOrCtrl+Shift+L")),
    ("view.outline", "Outline", "view", true, Some("CmdOrCtrl+Ctrl+1")),
    ("view.files", "File Tree", "view", true, Some("CmdOrCtrl+Ctrl+3")),
    ("view.focus", "Focus Mode", "view", true, Some("F8")),
    ("view.source", "Toggle Source", "view", true, Some("CmdOrCtrl+Alt+S")),
    ("view.commandPalette", "Command Palette", "view", true, Some("CmdOrCtrl+Shift+P")),
    ("export.html", "Export HTML", "export", true, Some("CmdOrCtrl+E")),
    ("export.pdf", "Export PDF", "export", true, Some("CmdOrCtrl+Shift+E")),
];

pub fn install_menu<R: Runtime>(app: &mut App<R>) -> tauri::Result<()> {
    let menu = build_menu(app.handle())?;
    app.set_menu(menu)?;
    Ok(())
}

pub fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    let command_id = event.id().0.as_str();
    let _ = app.emit(MENU_EVENT_NAME, command_id);
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let mut top_level: Vec<Submenu<R>> = Vec::new();

    #[cfg(target_os = "macos")]
    top_level.push(build_app_submenu(app)?);

    for (category, label) in [
        ("file", "File"),
        ("edit", "Edit"),
        ("paragraph", "Paragraph"),
        ("format", "Format"),
        ("view", "View"),
        ("export", "Export"),
    ] {
        if category == "edit" {
            top_level.push(build_edit_submenu(app, label)?);
            continue;
        }

        let items = build_command_items(app, category)?;
        let refs: Vec<&dyn tauri::menu::IsMenuItem<R>> =
            items.iter().map(|item| item as &dyn tauri::menu::IsMenuItem<R>).collect();
        top_level.push(Submenu::with_items(app, label, true, &refs)?);
    }

    #[cfg(target_os = "macos")]
    top_level.push(build_window_submenu(app)?);

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
fn build_window_submenu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    Submenu::with_items(
        app,
        "Window",
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
) -> tauri::Result<Vec<MenuItem<R>>> {
    COMMANDS
        .iter()
        .filter(|(_, _, item_category, _, _)| *item_category == category)
        .map(|(id, item_label, _, enabled, accelerator)| {
            MenuItem::with_id(app, *id, *item_label, *enabled, *accelerator)
        })
        .collect()
}

fn build_edit_submenu<R: Runtime>(app: &AppHandle<R>, label: &str) -> tauri::Result<Submenu<R>> {
    let edit_commands = build_command_items(app, "edit")?;
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
