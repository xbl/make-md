import type { CommandDef } from "@/lib/shortcuts/types";

export type CommandHandlerDeps = {
  openFile: () => Promise<unknown>;
  openFolder: () => Promise<unknown>;
  createNew: () => unknown;
  save: () => Promise<unknown>;
  saveAs: () => Promise<unknown>;
  exportHtml: () => Promise<unknown>;
  exportPdf: () => Promise<unknown>;
  openFind: () => void;
  openReplace: () => void;
  toggleSidebar: () => void;
  toggleFocusMode: () => void;
  openSettings: () => void;
  openAiSettings: () => void;
  openAiRewriteSelection: () => void;
  openAiRewriteDocument: () => void;
  openCommandPalette: () => void;
  closeTab: () => void;
  canRunEditorCommand?: (commandId: string) => boolean;
  runEditorCommand: (commandId: string) => boolean;
};

function def(
  id: string,
  label: string,
  category: CommandDef["category"],
  scope: CommandDef["scope"],
  defaultChord: string | null,
  enabled = true,
): CommandDef {
  return { id, label, category, scope, defaultChord, enabled };
}

export const COMMAND_CATALOG: CommandDef[] = [
  def("file.new", "New File", "file", "app", "Mod-n"),
  def("file.open", "Open File", "file", "app", "Mod-o"),
  def("file.openFolder", "Open Folder", "file", "app", "Mod-Shift-o"),
  def("file.save", "Save", "file", "app", "Mod-s"),
  def("file.saveAs", "Save As…", "file", "app", "Mod-Shift-s"),
  def("file.close", "Close Tab", "file", "app", "Mod-w"),
  def("app.preferences", "Preferences…", "file", "app", "Mod-Comma"),

  def("edit.find", "Find", "edit", "app", "Mod-f"),
  def("edit.replace", "Replace", "edit", "app", "Mod-h"),
  def("edit.findNext", "Find Next", "edit", "app", "Mod-g"),
  def("edit.findPrevious", "Find Previous", "edit", "app", "Mod-Shift-g"),
  def("edit.selectAll", "Select All", "edit", "editor", "Mod-a"),

  def("format.bold", "Bold", "format", "editor", "Mod-b"),
  def("format.italic", "Italic", "format", "editor", "Mod-i"),
  def("format.underline", "Underline", "format", "editor", "Mod-u", false),
  def("format.inlineCode", "Inline Code", "format", "editor", "Mod-Shift-Backquote"),
  def("format.strike", "Strikethrough", "format", "editor", "Ctrl-Shift-Backquote"),
  def("format.link", "Hyperlink", "format", "editor", "Mod-k"),
  def("format.image", "Image", "format", "editor", "Mod-Control-i", false),
  def("format.clear", "Clear Formatting", "format", "editor", "Mod-Backslash"),

  def("paragraph.h1", "Heading 1", "paragraph", "editor", "Mod-1"),
  def("paragraph.h2", "Heading 2", "paragraph", "editor", "Mod-2"),
  def("paragraph.h3", "Heading 3", "paragraph", "editor", "Mod-3"),
  def("paragraph.h4", "Heading 4", "paragraph", "editor", "Mod-4"),
  def("paragraph.h5", "Heading 5", "paragraph", "editor", "Mod-5"),
  def("paragraph.h6", "Heading 6", "paragraph", "editor", "Mod-6"),
  def("paragraph.paragraph", "Paragraph", "paragraph", "editor", "Mod-0"),
  def("paragraph.increaseHeading", "Increase Heading Level", "paragraph", "editor", "Mod-Equal"),
  def("paragraph.decreaseHeading", "Decrease Heading Level", "paragraph", "editor", "Mod-Minus"),
  def("paragraph.quote", "Quote", "paragraph", "editor", "Mod-Alt-q"),
  def("paragraph.orderedList", "Ordered List", "paragraph", "editor", "Mod-Alt-o"),
  def("paragraph.unorderedList", "Unordered List", "paragraph", "editor", "Mod-Alt-u"),
  def("paragraph.codeFence", "Code Fences", "paragraph", "editor", "Mod-Alt-c"),
  def("paragraph.table", "Table", "paragraph", "editor", "Mod-Alt-t", false),

  def("view.sidebar", "Toggle Sidebar", "view", "view", "Mod-Shift-l"),
  def("view.outline", "Outline", "view", "view", "Mod-Control-1"),
  def("view.files", "File Tree", "view", "view", "Mod-Control-3"),
  def("view.focus", "Focus Mode", "view", "view", "F8"),
  def("view.aiSettings", "AI Settings", "view", "app", null),
  def("view.aiRewriteSelection", "AI Rewrite Selection", "view", "editor", "Mod-Shift-a"),
  def("view.aiRewriteDocument", "AI Rewrite Document", "view", "app", null),
  def("view.commandPalette", "Command Palette", "view", "app", "Mod-Shift-p"),

  def("export.html", "Export HTML", "export", "export", "Mod-e"),
  def("export.pdf", "Export PDF", "export", "export", "Mod-Shift-e"),
];

export function getDefaultChordMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const command of COMMAND_CATALOG) {
    if (command.defaultChord) {
      map[command.id] = command.defaultChord;
    }
  }
  return map;
}

export function createCommandHandlers(deps: CommandHandlerDeps): Record<string, () => void | Promise<void>> {
  const editor = (commandId: string) => () => {
    deps.runEditorCommand(commandId);
  };

  return {
    "file.new": () => deps.createNew(),
    "file.open": () => deps.openFile(),
    "file.openFolder": () => deps.openFolder(),
    "file.save": () => deps.save(),
    "file.saveAs": () => deps.saveAs(),
    "file.close": () => deps.closeTab(),
    "app.preferences": () => deps.openSettings(),

    "edit.find": () => deps.openFind(),
    "edit.replace": () => deps.openReplace(),
    "edit.findNext": editor("edit.findNext"),
    "edit.findPrevious": editor("edit.findPrevious"),
    "edit.selectAll": editor("edit.selectAll"),

    "format.bold": editor("format.bold"),
    "format.italic": editor("format.italic"),
    "format.underline": editor("format.underline"),
    "format.inlineCode": editor("format.inlineCode"),
    "format.strike": editor("format.strike"),
    "format.link": editor("format.link"),
    "format.image": editor("format.image"),
    "format.clear": editor("format.clear"),

    "paragraph.h1": editor("paragraph.h1"),
    "paragraph.h2": editor("paragraph.h2"),
    "paragraph.h3": editor("paragraph.h3"),
    "paragraph.h4": editor("paragraph.h4"),
    "paragraph.h5": editor("paragraph.h5"),
    "paragraph.h6": editor("paragraph.h6"),
    "paragraph.paragraph": editor("paragraph.paragraph"),
    "paragraph.increaseHeading": editor("paragraph.increaseHeading"),
    "paragraph.decreaseHeading": editor("paragraph.decreaseHeading"),
    "paragraph.quote": editor("paragraph.quote"),
    "paragraph.orderedList": editor("paragraph.orderedList"),
    "paragraph.unorderedList": editor("paragraph.unorderedList"),
    "paragraph.codeFence": editor("paragraph.codeFence"),
    "paragraph.table": editor("paragraph.table"),

    "view.sidebar": () => deps.toggleSidebar(),
    "view.outline": editor("view.outline"),
    "view.files": editor("view.files"),
    "view.focus": () => deps.toggleFocusMode(),
    "view.aiSettings": () => deps.openAiSettings(),
    "view.aiRewriteSelection": () => deps.openAiRewriteSelection(),
    "view.aiRewriteDocument": () => deps.openAiRewriteDocument(),
    "view.commandPalette": () => deps.openCommandPalette(),

    "export.html": () => deps.exportHtml(),
    "export.pdf": () => deps.exportPdf(),
  };
}

export function buildCommandManifest() {
  return COMMAND_CATALOG.map(({ id, label, category, enabled }) => ({
    id,
    label,
    category,
    enabled,
  }));
}
