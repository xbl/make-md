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

  it("does not intercept system reserved shortcuts like copy, paste, undo, redo, or quit", async () => {
    const copyHandler = vi.fn();
    const dispatcher = createShortcutDispatcher({
      handlers: {
        "format.bold": copyHandler,
      },
      getContext: () => ({ editorFocused: true, hasSelection: true, inInlineMark: false }),
      getChordMap: () => ({
        "format.bold": "Mod-c",
      }),
      isEditorFocused: () => true,
    });

    const event = new KeyboardEvent("keydown", { key: "c", metaKey: true, bubbles: true, cancelable: true });
    const handled = await dispatcher.handleKeydown(event);

    expect(handled).toBe(false);
    expect(event.defaultPrevented).toBe(false);
    expect(copyHandler).not.toHaveBeenCalled();
  });
});
