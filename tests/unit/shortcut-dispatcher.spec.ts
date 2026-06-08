import { describe, it, expect, vi } from "vitest";
import { createShortcutDispatcher } from "@/lib/shortcuts/dispatcher";

describe("createShortcutDispatcher", () => {
  it("runs export on Mod-e without editor selection", async () => {
    const exportHtml = vi.fn();
    const dispatcher = createShortcutDispatcher({
      handlers: { "export.html": exportHtml },
      getContext: () => ({ editorFocused: true, hasSelection: false, inInlineMark: false }),
      getChordMap: () => ({ "export.html": "Mod-e", "format.inlineCode": "Mod-Shift-Backquote" }),
      isEditorFocused: () => true,
    });

    const event = new KeyboardEvent("keydown", { key: "e", metaKey: true, bubbles: true });
    const handled = await dispatcher.handleKeydown(event);
    expect(handled).toBe(true);
    expect(exportHtml).toHaveBeenCalled();
  });

  it("runs AI rewrite selection on Mod-Shift-a when editor is focused", async () => {
    const rewriteSelection = vi.fn();
    const dispatcher = createShortcutDispatcher({
      handlers: { "view.aiRewriteSelection": rewriteSelection },
      getContext: () => ({ editorFocused: true, hasSelection: true, inInlineMark: false }),
      getChordMap: () => ({ "view.aiRewriteSelection": "Mod-Shift-a" }),
      isEditorFocused: () => true,
    });

    const event = new KeyboardEvent("keydown", { key: "A", metaKey: true, shiftKey: true, bubbles: true });
    const handled = await dispatcher.handleKeydown(event);
    expect(handled).toBe(true);
    expect(rewriteSelection).toHaveBeenCalled();
  });
});
