export type AppCommand = {
  id: string;
  label: string;
  shortcut?: string;
  run: () => void | Promise<void>;
};

export type AppCommandDeps = {
  openFile: () => Promise<unknown>;
  createNew: () => unknown;
  save: () => Promise<unknown>;
  saveAs: () => Promise<unknown>;
  exportHtml: () => Promise<unknown>;
  toggleSidebar: () => void;
  toggleFocusMode: () => void;
  toggleTheme: () => void;
};

export function createAppCommands(deps: AppCommandDeps): AppCommand[] {
  return [
    {
      id: "new",
      label: "New File",
      shortcut: "⌘N",
      run: deps.createNew,
    },
    {
      id: "open",
      label: "Open File",
      shortcut: "⌘O",
      run: deps.openFile,
    },
    {
      id: "save",
      label: "Save",
      shortcut: "⌘S",
      run: deps.save,
    },
    {
      id: "save-as",
      label: "Save As",
      shortcut: "⌘⇧S",
      run: deps.saveAs,
    },
    {
      id: "export-html",
      label: "Export HTML",
      shortcut: "⌘E",
      run: deps.exportHtml,
    },
    {
      id: "toggle-focus",
      label: "Toggle Focus Mode",
      shortcut: "F8",
      run: deps.toggleFocusMode,
    },
    {
      id: "toggle-theme",
      label: "Toggle Light/Dark Theme",
      shortcut: "⌘⇧L",
      run: deps.toggleTheme,
    },
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      shortcut: "⌘\\",
      run: deps.toggleSidebar,
    },
  ];
}
