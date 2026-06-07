export type AppCommand = {
  id: string;
  label: string;
  run: () => void | Promise<void>;
};

export type AppCommandDeps = {
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
  toggleTheme: () => void;
};

export function createAppCommands(deps: AppCommandDeps): AppCommand[] {
  return [
    {
      id: "new",
      label: "New File",
      run: deps.createNew,
    },
    {
      id: "open-folder",
      label: "Open Folder",
      run: deps.openFolder,
    },
    {
      id: "open",
      label: "Open File",
      run: deps.openFile,
    },
    {
      id: "save",
      label: "Save",
      run: deps.save,
    },
    {
      id: "save-as",
      label: "Save As",
      run: deps.saveAs,
    },
    {
      id: "export-html",
      label: "Export HTML",
      run: deps.exportHtml,
    },
    {
      id: "export-pdf",
      label: "Export PDF",
      run: deps.exportPdf,
    },
    {
      id: "find",
      label: "Find in Document",
      run: deps.openFind,
    },
    {
      id: "replace",
      label: "Replace in Document",
      run: deps.openReplace,
    },
    {
      id: "toggle-focus",
      label: "Toggle Focus Mode",
      run: deps.toggleFocusMode,
    },
    {
      id: "toggle-theme",
      label: "Toggle Light/Dark Theme",
      run: deps.toggleTheme,
    },
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      run: deps.toggleSidebar,
    },
  ];
}
