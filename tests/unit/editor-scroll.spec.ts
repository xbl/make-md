import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { markdownSchema } from "../../src/editor/schema";
import { parseMarkdown } from "../../src/editor/markdown-parser";
import { scrollEditorToPosition } from "../../src/lib/editor-scroll";

function createMockView(state: EditorState, dom: HTMLElement, extras: Partial<EditorView> = {}) {
  dom.focus = vi.fn();
  return {
    state,
    dom,
    dispatch: vi.fn(),
    ...extras,
  } as unknown as EditorView;
}

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
    const viewDom = document.createElement("div");
    editorScroll.appendChild(viewDom);
    document.body.appendChild(sidebar);
    document.body.appendChild(editorScroll);

    Object.defineProperty(editorScroll, "clientHeight", { value: 300 });
    Object.defineProperty(editorScroll, "scrollHeight", { value: 900 });
    Object.defineProperty(editorScroll, "getBoundingClientRect", {
      value: () => ({ top: 100, left: 0, width: 800, height: 300 }),
    });

    const doc = parseMarkdown("# Title");
    const state = EditorState.create({ schema: markdownSchema, doc });
    const view = createMockView(state, viewDom, {
      coordsAtPos: () => ({ top: 420, bottom: 440, left: 0, right: 0 }),
      nodeDOM: vi.fn(() => null),
    });

    scrollEditorToPosition(view, 0);
    vi.runAllTimers();

    expect(sidebar.scrollTop).toBe(120);
    expect(editorScroll.scrollTop).toBeGreaterThan(0);

    document.body.removeChild(sidebar);
    document.body.removeChild(editorScroll);
  });

  it("scrolls the editor container when the heading node is available", () => {
    const editorScroll = document.createElement("section");
    editorScroll.className = "app-shell__editor";
    editorScroll.scrollTop = 0;
    document.body.appendChild(editorScroll);

    Object.defineProperty(editorScroll, "clientHeight", { value: 300 });
    Object.defineProperty(editorScroll, "scrollHeight", { value: 900 });
    Object.defineProperty(editorScroll, "getBoundingClientRect", {
      value: () => ({ top: 100, left: 0, width: 800, height: 300, bottom: 400, right: 800 }),
    });

    const heading = document.createElement("h1");
    heading.textContent = "Title";
    Object.defineProperty(heading, "getBoundingClientRect", {
      value: () => ({ top: 620, left: 40, width: 560, height: 32, bottom: 652, right: 600 }),
    });
    heading.scrollIntoView = vi.fn();

    const viewDom = document.createElement("div");
    viewDom.appendChild(heading);
    editorScroll.appendChild(viewDom);

    const doc = parseMarkdown("# Title");
    const state = EditorState.create({ schema: markdownSchema, doc });
    const view = createMockView(state, viewDom, {
      nodeDOM: () => heading,
    });

    scrollEditorToPosition(view, 0);
    vi.runAllTimers();

    expect(heading.scrollIntoView).not.toHaveBeenCalled();
    expect(editorScroll.scrollTop).toBeGreaterThan(0);

    document.body.removeChild(editorScroll);
  });
});
