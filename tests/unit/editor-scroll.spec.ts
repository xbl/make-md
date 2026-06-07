import { describe, it, expect, vi } from "vitest";
import { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { markdownSchema } from "../../src/editor/schema";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { scrollEditorToPosition } from "../../src/lib/editor-scroll";

describe("scrollEditorToPosition", () => {
  it("does not change sidebar scroll position", () => {
    const sidebar = document.createElement("div");
    sidebar.className = "panel__body";
    sidebar.scrollTop = 120;

    const editorScroll = document.createElement("section");
    editorScroll.className = "app-shell__editor";
    document.body.appendChild(sidebar);
    document.body.appendChild(editorScroll);

    const scrollTo = vi.fn((options: ScrollToOptions) => {
      editorScroll.scrollTop = options.top ?? 0;
    });
    editorScroll.scrollTo = scrollTo as typeof editorScroll.scrollTo;

    Object.defineProperty(editorScroll, "clientHeight", { value: 300 });
    Object.defineProperty(editorScroll, "getBoundingClientRect", {
      value: () => ({ top: 100, left: 0, width: 800, height: 300 }),
    });

    const doc = parseMarkdown("# Title");
    const state = EditorState.create({ schema: markdownSchema, doc });
    const view = {
      state,
      dispatch: vi.fn(),
      coordsAtPos: () => ({ top: 420, bottom: 440, left: 0, right: 0 }),
      dom: { focus: vi.fn() },
    } as unknown as EditorView;

    scrollEditorToPosition(view, 1);

    expect(sidebar.scrollTop).toBe(120);
    expect(scrollTo).toHaveBeenCalled();

    document.body.removeChild(sidebar);
    document.body.removeChild(editorScroll);
  });
});
