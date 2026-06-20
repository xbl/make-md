import { describe, expect, it, vi } from "vitest";
import { createAppCommandRuntime } from "@/lib/app-commands";

describe("createAppCommandRuntime", () => {
  it("shows the requested sidebar tab instead of leaving the sidebar collapsed", () => {
    const showSidebarTab = vi.fn();
    const runtime = createAppCommandRuntime({
      openFile: vi.fn(),
      openFolder: vi.fn(),
      createNew: vi.fn(),
      save: vi.fn(),
      saveAs: vi.fn(),
      exportHtml: vi.fn(),
      exportPdf: vi.fn(),
      exportWord: vi.fn(),
      openFind: vi.fn(),
      openReplace: vi.fn(),
      toggleSidebar: vi.fn(),
      toggleFocusMode: vi.fn(),
      toggleSourceMode: vi.fn(),
      showSidebarTab,
      openSettings: vi.fn(),
      openAiSettings: vi.fn(),
      openAiRewriteSelection: vi.fn(),
      openAiRewriteDocument: vi.fn(),
      openCommandPalette: vi.fn(),
      closeTab: vi.fn(),
      runEditorCommand: vi.fn(() => true),
    });

    runtime.handlers["view.outline"]();
    runtime.handlers["view.files"]();

    expect(showSidebarTab).toHaveBeenNthCalledWith(1, "outline");
    expect(showSidebarTab).toHaveBeenNthCalledWith(2, "files");
  });
});
