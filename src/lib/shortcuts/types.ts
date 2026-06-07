export type CommandScope = "app" | "editor" | "export" | "view";

export type CommandCategory =
  | "file"
  | "edit"
  | "paragraph"
  | "format"
  | "view"
  | "export";

export type CommandDef = {
  id: string;
  label: string;
  category: CommandCategory;
  scope: CommandScope;
  defaultChord: string | null;
  enabled: boolean;
};

export type ShortcutOverrides = Record<string, string | null>;

export type ShortcutContext = {
  editorFocused: boolean;
  hasSelection: boolean;
  inInlineMark: boolean;
};
