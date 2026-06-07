import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { markdownSchema } from "../../src/editor/schema";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { scrollEditorToPosition } from "../../src/lib/editor-scroll";

describe("scrollEditorToPosition", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not change sidebar scroll position", () => {
    const sidebar = document.createElement("div");
    sidebar.className = "panel__body";
    sidebar.scrollTop = 120;

    const editorScroll = document.createElement("section");
    editorScroll.className = "app-shell__editor";
    document.body.appendChild(sidebar);
    document.body.appendChild(editorScroll);

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
      nodeDOM: vi.fn(() => null),
    } as unknown as EditorView;

    scrollEditorToPosition(view, 1);
    vi.runAllTimers();

    expect(sidebar.scrollTop).toBe(120);
    expect(editorScroll.scrollTop).toBeGreaterThan(0);
    expect(view.dispatch).toHaveBeenCalledTimes(1);

    document.body.removeChild(sidebar);
    document.body.removeChild(editorScroll);
  });

  it("scrolls the heading node into view when available", () => {
    const editorScroll = document.createElement("section");
    editorScroll.className = "app-shell__editor";
    document.body.appendChild(editorScroll);

    const heading = document.createElement("h1");
    heading.scrollIntoView = vi.fn();

    const doc = parseMarkdown("# Title");
    const state = EditorState.create({ schema: markdownSchema, doc });
    const view = {
      state,
      dispatch: vi.fn(),
      nodeDOM: () => heading,
      dom: { focus: vi.fn() },
    } as unknown as EditorView;

    scrollEditorToPosition(view, 1);
    vi.runAllTimers();

    expect(heading.scrollIntoView).toHaveBeenCalledWith({ block: "center", inline: "nearest" });
    expect(view.dispatch).toHaveBeenCalledTimes(1);

    document.body.removeChild(editorScroll);
  });
});
