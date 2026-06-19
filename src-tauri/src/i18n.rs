pub const DEFAULT_LOCALE: &str = "en";

pub fn normalize_locale(locale: &str) -> &'static str {
    let lower = locale.trim().to_ascii_lowercase();
    if lower.starts_with("zh") {
        "zh-CN"
    } else if lower.starts_with("en") {
        "en"
    } else {
        DEFAULT_LOCALE
    }
}

pub fn menu_label<'a>(locale: &str, key: &'a str) -> &'a str {
    match (normalize_locale(locale), key) {
        ("zh-CN", "menu.file") => "文件",
        ("zh-CN", "menu.edit") => "编辑",
        ("zh-CN", "menu.paragraph") => "段落",
        ("zh-CN", "menu.format") => "格式",
        ("zh-CN", "menu.view") => "视图",
        ("zh-CN", "menu.export") => "导出",
        ("zh-CN", "menu.window") => "窗口",
        ("zh-CN", "menu.file.new") => "新建文件",
        ("zh-CN", "menu.file.open") => "打开文件",
        ("zh-CN", "menu.file.openFolder") => "打开文件夹",
        ("zh-CN", "menu.file.save") => "保存",
        ("zh-CN", "menu.file.saveAs") => "另存为…",
        ("zh-CN", "menu.file.close") => "关闭标签页",
        ("zh-CN", "menu.app.preferences") => "偏好设置…",
        ("zh-CN", "menu.edit.find") => "查找",
        ("zh-CN", "menu.edit.replace") => "替换",
        ("zh-CN", "menu.edit.findNext") => "查找下一个",
        ("zh-CN", "menu.edit.findPrevious") => "查找上一个",
        ("zh-CN", "menu.edit.selectAll") => "全选",
        ("zh-CN", "menu.format.bold") => "粗体",
        ("zh-CN", "menu.format.italic") => "斜体",
        ("zh-CN", "menu.format.underline") => "下划线",
        ("zh-CN", "menu.format.inlineCode") => "行内代码",
        ("zh-CN", "menu.format.strike") => "删除线",
        ("zh-CN", "menu.format.link") => "超链接",
        ("zh-CN", "menu.format.image") => "图片",
        ("zh-CN", "menu.format.clear") => "清除格式",
        ("zh-CN", "menu.paragraph.h1") => "标题 1",
        ("zh-CN", "menu.paragraph.h2") => "标题 2",
        ("zh-CN", "menu.paragraph.h3") => "标题 3",
        ("zh-CN", "menu.paragraph.h4") => "标题 4",
        ("zh-CN", "menu.paragraph.h5") => "标题 5",
        ("zh-CN", "menu.paragraph.h6") => "标题 6",
        ("zh-CN", "menu.paragraph.paragraph") => "正文",
        ("zh-CN", "menu.paragraph.increaseHeading") => "提升标题层级",
        ("zh-CN", "menu.paragraph.decreaseHeading") => "降低标题层级",
        ("zh-CN", "menu.paragraph.quote") => "引用",
        ("zh-CN", "menu.paragraph.orderedList") => "有序列表",
        ("zh-CN", "menu.paragraph.unorderedList") => "无序列表",
        ("zh-CN", "menu.paragraph.codeFence") => "代码块",
        ("zh-CN", "menu.paragraph.table") => "表格",
        ("zh-CN", "menu.view.sidebar") => "切换侧边栏",
        ("zh-CN", "menu.view.outline") => "大纲",
        ("zh-CN", "menu.view.files") => "文件树",
        ("zh-CN", "menu.view.focus") => "专注模式",
        ("zh-CN", "menu.view.source") => "切换源码模式",
        ("zh-CN", "menu.view.commandPalette") => "命令面板",
        ("zh-CN", "menu.export.html") => "导出 HTML",
        ("zh-CN", "menu.export.pdf") => "导出 PDF",
        ("zh-CN", "menu.export.word") => "导出 Word",
        ("en", "menu.file") => "File",
        ("en", "menu.edit") => "Edit",
        ("en", "menu.paragraph") => "Paragraph",
        ("en", "menu.format") => "Format",
        ("en", "menu.view") => "View",
        ("en", "menu.export") => "Export",
        ("en", "menu.window") => "Window",
        ("en", "menu.file.new") => "New File",
        ("en", "menu.file.open") => "Open File",
        ("en", "menu.file.openFolder") => "Open Folder",
        ("en", "menu.file.save") => "Save",
        ("en", "menu.file.saveAs") => "Save As…",
        ("en", "menu.file.close") => "Close Tab",
        ("en", "menu.app.preferences") => "Preferences…",
        ("en", "menu.edit.find") => "Find",
        ("en", "menu.edit.replace") => "Replace",
        ("en", "menu.edit.findNext") => "Find Next",
        ("en", "menu.edit.findPrevious") => "Find Previous",
        ("en", "menu.edit.selectAll") => "Select All",
        ("en", "menu.format.bold") => "Bold",
        ("en", "menu.format.italic") => "Italic",
        ("en", "menu.format.underline") => "Underline",
        ("en", "menu.format.inlineCode") => "Inline Code",
        ("en", "menu.format.strike") => "Strikethrough",
        ("en", "menu.format.link") => "Hyperlink",
        ("en", "menu.format.image") => "Image",
        ("en", "menu.format.clear") => "Clear Formatting",
        ("en", "menu.paragraph.h1") => "Heading 1",
        ("en", "menu.paragraph.h2") => "Heading 2",
        ("en", "menu.paragraph.h3") => "Heading 3",
        ("en", "menu.paragraph.h4") => "Heading 4",
        ("en", "menu.paragraph.h5") => "Heading 5",
        ("en", "menu.paragraph.h6") => "Heading 6",
        ("en", "menu.paragraph.paragraph") => "Paragraph",
        ("en", "menu.paragraph.increaseHeading") => "Increase Heading Level",
        ("en", "menu.paragraph.decreaseHeading") => "Decrease Heading Level",
        ("en", "menu.paragraph.quote") => "Quote",
        ("en", "menu.paragraph.orderedList") => "Ordered List",
        ("en", "menu.paragraph.unorderedList") => "Unordered List",
        ("en", "menu.paragraph.codeFence") => "Code Fences",
        ("en", "menu.paragraph.table") => "Table",
        ("en", "menu.view.sidebar") => "Toggle Sidebar",
        ("en", "menu.view.outline") => "Outline",
        ("en", "menu.view.files") => "File Tree",
        ("en", "menu.view.focus") => "Focus Mode",
        ("en", "menu.view.source") => "Toggle Source",
        ("en", "menu.view.commandPalette") => "Command Palette",
        ("en", "menu.export.html") => "Export HTML",
        ("en", "menu.export.pdf") => "Export PDF",
        ("en", "menu.export.word") => "Export Word",
        ("zh-CN", "menu.file.openRecent") => "打开最近文件",
        ("zh-CN", "menu.file.clearRecent") => "清空最近文件",
        ("zh-CN", "menu.file.noRecentFiles") => "没有最近文件",
        ("en", "menu.file.openRecent") => "Open Recent",
        ("en", "menu.file.clearRecent") => "Clear Recently Opened",
        ("en", "menu.file.noRecentFiles") => "No Recent Files",
        _ => key,
    }
}

#[tauri::command]
pub fn get_system_locale() -> String {
    if let Ok(locale) = std::env::var("LC_ALL") {
        if !locale.trim().is_empty() {
            return locale;
        }
    }
    if let Ok(locale) = std::env::var("LANG") {
        if !locale.trim().is_empty() {
            return locale;
        }
    }
    "en-US".to_string()
}

#[cfg(test)]
mod tests {
    use super::{menu_label, normalize_locale};

    #[test]
    fn normalizes_system_locales() {
        assert_eq!(normalize_locale("zh-Hans-CN"), "zh-CN");
        assert_eq!(normalize_locale("en-GB"), "en");
        assert_eq!(normalize_locale("fr-FR"), "en");
    }

    #[test]
    fn returns_translated_menu_labels() {
        assert_eq!(menu_label("zh-CN", "menu.file"), "文件");
        assert_eq!(menu_label("zh-CN", "menu.export.word"), "导出 Word");
        assert_eq!(menu_label("en", "menu.file.open"), "Open File");
    }
}
