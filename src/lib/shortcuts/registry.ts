import type { CommandDef } from "@/lib/shortcuts/types";
import { DEFAULT_LOCALE, translate, type MessageKey, type SupportedLocale } from "@/i18n/catalog";

export type CommandHandlerDeps = {
  openFile: () => Promise<unknown>;
  openFolder: () => Promise<unknown>;
  createNew: () => unknown;
  save: () => Promise<unknown>;
  saveAs: () => Promise<unknown>;
  exportHtml: () => Promise<unknown>;
  exportPdf: () => Promise<unknown>;
  exportWord: () => Promise<unknown>;
  openFind: () => void;
  openReplace: () => void;
  toggleSidebar: () => void;
  toggleFocusMode: () => void;
  toggleSourceMode: () => void;
  openSettings: () => void;
  openAiSettings: () => void;
  openAiRewriteSelection: () => void;
  openAiRewriteDocument: () => void;
  openCommandPalette: () => void;
  closeTab: () => void;
  canRunEditorCommand?: (commandId: string) => boolean;
  runEditorCommand: (commandId: string) => boolean;
};

type CommandSeed = Omit<CommandDef, "label"> & {
  labelKey: MessageKey;
};

function def(
  id: string,
  labelKey: MessageKey,
  category: CommandDef["category"],
  scope: CommandDef["scope"],
  defaultChord: string | null,
  enabled = true,
): CommandSeed {
  return { id, labelKey, category, scope, defaultChord, enabled };
}

const COMMAND_SEEDS: CommandSeed[] = [
  def("file.new", "command.file.new", "file", "app", "Mod-n"),
  def("file.open", "command.file.open", "file", "app", "Mod-o"),
  def("file.openFolder", "command.file.openFolder", "file", "app", "Mod-Shift-o"),
  def("file.save", "command.file.save", "file", "app", "Mod-s"),
  def("file.saveAs", "command.file.saveAs", "file", "app", "Mod-Shift-s"),
  def("file.close", "command.file.close", "file", "app", "Mod-w"),
  def("app.preferences", "command.app.preferences", "file", "app", "Mod-Comma"),

  def("edit.find", "command.edit.find", "edit", "app", "Mod-f"),
  def("edit.replace", "command.edit.replace", "edit", "app", "Mod-Alt-f"),
  def("edit.findNext", "command.edit.findNext", "edit", "app", "Mod-g"),
  def("edit.findPrevious", "command.edit.findPrevious", "edit", "app", "Mod-Shift-g"),
  def("edit.selectAll", "command.edit.selectAll", "edit", "editor", "Mod-a"),

  def("format.bold", "command.format.bold", "format", "editor", "Mod-b"),
  def("format.italic", "command.format.italic", "format", "editor", "Mod-i"),
  def("format.underline", "command.format.underline", "format", "editor", "Mod-u", false),
  def("format.inlineCode", "command.format.inlineCode", "format", "editor", "Mod-Shift-Backquote"),
  def("format.strike", "command.format.strike", "format", "editor", "Ctrl-Shift-Backquote"),
  def("format.link", "command.format.link", "format", "editor", "Mod-k"),
  def("format.image", "command.format.image", "format", "editor", "Mod-Control-i"),
  def("format.clear", "command.format.clear", "format", "editor", "Mod-Backslash"),

  def("paragraph.h1", "command.paragraph.h1", "paragraph", "editor", "Mod-1"),
  def("paragraph.h2", "command.paragraph.h2", "paragraph", "editor", "Mod-2"),
  def("paragraph.h3", "command.paragraph.h3", "paragraph", "editor", "Mod-3"),
  def("paragraph.h4", "command.paragraph.h4", "paragraph", "editor", "Mod-4"),
  def("paragraph.h5", "command.paragraph.h5", "paragraph", "editor", "Mod-5"),
  def("paragraph.h6", "command.paragraph.h6", "paragraph", "editor", "Mod-6"),
  def("paragraph.paragraph", "command.paragraph.paragraph", "paragraph", "editor", "Mod-0"),
  def("paragraph.increaseHeading", "command.paragraph.increaseHeading", "paragraph", "editor", "Mod-Equal"),
  def("paragraph.decreaseHeading", "command.paragraph.decreaseHeading", "paragraph", "editor", "Mod-Minus"),
  def("paragraph.quote", "command.paragraph.quote", "paragraph", "editor", "Mod-Alt-q"),
  def("paragraph.orderedList", "command.paragraph.orderedList", "paragraph", "editor", "Mod-Alt-o"),
  def("paragraph.unorderedList", "command.paragraph.unorderedList", "paragraph", "editor", "Mod-Alt-u"),
  def("paragraph.codeFence", "command.paragraph.codeFence", "paragraph", "editor", "Mod-Alt-c"),
  def("paragraph.table", "command.paragraph.table", "paragraph", "editor", "Mod-Alt-t"),

  def("view.sidebar", "command.view.sidebar", "view", "view", "Mod-Shift-l"),
  def("view.outline", "command.view.outline", "view", "view", "Mod-Control-1"),
  def("view.files", "command.view.files", "view", "view", "Mod-Control-3"),
  def("view.focus", "command.view.focus", "view", "view", "F8"),
  def("view.source", "command.view.source", "view", "view", null),
  def("view.aiSettings", "command.view.aiSettings", "view", "app", null),
  def("view.aiRewriteSelection", "command.view.aiRewriteSelection", "view", "editor", "Mod-Shift-a"),
  def("view.aiRewriteDocument", "command.view.aiRewriteDocument", "view", "app", null),
  def("view.commandPalette", "command.view.commandPalette", "view", "app", "Mod-Shift-p"),

  def("export.html", "command.export.html", "export", "export", "Mod-e"),
  def("export.pdf", "command.export.pdf", "export", "export", "Mod-Shift-e"),
  def("export.word", "command.export.word", "export", "export", null),
];

export function getCommandCatalog(locale: SupportedLocale): CommandDef[] {
  return COMMAND_SEEDS.map(({ labelKey, ...command }) => ({
    ...command,
    label: translate(locale, labelKey),
  }));
}

export const COMMAND_CATALOG: CommandDef[] = getCommandCatalog(DEFAULT_LOCALE);

export function getDefaultChordMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const command of COMMAND_SEEDS) {
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
    "file.new": () => {
      void deps.createNew();
    },
    "file.open": async () => {
      await deps.openFile();
    },
    "file.openFolder": async () => {
      await deps.openFolder();
    },
    "file.save": async () => {
      await deps.save();
    },
    "file.saveAs": async () => {
      await deps.saveAs();
    },
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
    "view.source": () => deps.toggleSourceMode(),
    "view.aiSettings": () => deps.openAiSettings(),
    "view.aiRewriteSelection": () => deps.openAiRewriteSelection(),
    "view.aiRewriteDocument": () => deps.openAiRewriteDocument(),
    "view.commandPalette": () => deps.openCommandPalette(),

    "export.html": async () => {
      await deps.exportHtml();
    },
    "export.pdf": async () => {
      await deps.exportPdf();
    },
    "export.word": async () => {
      await deps.exportWord();
    },
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
