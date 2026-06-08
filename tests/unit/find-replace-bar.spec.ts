import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FindReplaceBar from "@/components/FindReplaceBar.vue";
import { markdownSchema } from "@/editor/schema";
import { createEditorPlugins } from "@/editor/plugins";
import * as editorScroll from "@/lib/editor-scroll";
import { useEditorStore } from "@/stores/editor";
import { useUiStore } from "@/stores/ui";

function mountBarWithSelection(from = 1, to = 6) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const ui = useUiStore();
  const editorStore = useEditorStore();

  const mountNode = document.createElement("div");
  document.body.appendChild(mountNode);

  const state = EditorState.create({
    schema: markdownSchema,
    doc: markdownSchema.node("doc", null, [
      markdownSchema.node("paragraph", null, [markdownSchema.text("alpha beta alpha")]),
    ]),
    selection: TextSelection.create(
      markdownSchema.node("doc", null, [
        markdownSchema.node("paragraph", null, [markdownSchema.text("alpha beta alpha")]),
      ]),
      from,
      to,
    ),
    plugins: createEditorPlugins(),
  });

  const view = new EditorView(mountNode, { state });
  editorStore.setView(view);

  const wrapper = mount(FindReplaceBar, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
    },
  });

  ui.openFindReplace("find");

  return { wrapper, ui, view, mountNode };
}

function mountBarWithSourceSelection(start = 0, end = 5) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const ui = useUiStore();
  const editorStore = useEditorStore();

  let selection = { start, end };
  editorStore.setSourceEditor({
    getValue: () => "alpha beta alpha",
    getSelection: () => selection,
    setSelection: (nextStart, nextEnd) => {
      selection = { start: nextStart, end: nextEnd };
    },
    replaceSelection: () => {},
    focus: () => {},
  });

  const wrapper = mount(FindReplaceBar, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
    },
  });

  ui.toggleSourceMode();
  ui.openFindReplace("find");

  return { wrapper, ui, editorStore, getSelection: () => selection };
}

describe("FindReplaceBar", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("prefills the query from the current editor selection", async () => {
    const { wrapper, view, mountNode } = mountBarWithSelection(1, 6);
    await nextTick();

    expect((wrapper.find("input.find-bar__input").element as HTMLInputElement).value).toBe("alpha");
    expect(wrapper.text()).toContain("1/2");

    wrapper.unmount();
    view.destroy();
    mountNode.remove();
  });

  it("finds next on Enter and previous on Shift+Enter from the query input", async () => {
    const { wrapper, view, mountNode } = mountBarWithSelection(1, 6);
    const scrollSpy = vi.spyOn(editorScroll, "scrollEditorToPosition").mockImplementation(() => {});
    await nextTick();

    const queryInput = wrapper.find("input.find-bar__input");
    (queryInput.element as HTMLInputElement).focus();
    await queryInput.trigger("keydown", { key: "Enter" });
    await nextTick();
    expect(view.state.selection.from).toBe(12);
    expect(view.state.selection.to).toBe(17);
    expect(wrapper.text()).toContain("2/2");
    expect(document.activeElement).toBe(queryInput.element);
    expect(scrollSpy).toHaveBeenLastCalledWith(view, 11);

    await queryInput.trigger("keydown", { key: "Enter", shiftKey: true });
    await nextTick();
    expect(view.state.selection.from).toBe(1);
    expect(view.state.selection.to).toBe(6);
    expect(wrapper.text()).toContain("1/2");
    expect(document.activeElement).toBe(queryInput.element);
    expect(scrollSpy).toHaveBeenLastCalledWith(view, 0);

    wrapper.unmount();
    view.destroy();
    mountNode.remove();
  });

  it("renders previous and next icon buttons next to the query input", async () => {
    const { wrapper, view, mountNode } = mountBarWithSelection(1, 6);
    await nextTick();

    const navButtons = wrapper.findAll("button.find-bar__icon-button");
    expect(navButtons).toHaveLength(2);
    expect(navButtons[0]?.attributes("title")).toBe("Previous match");
    expect(navButtons[1]?.attributes("title")).toBe("Next match");

    const queryField = wrapper.find(".find-bar__query");
    expect(queryField.exists()).toBe(true);
    expect(queryField.findAll("button.find-bar__icon-button")).toHaveLength(2);

    wrapper.unmount();
    view.destroy();
    mountNode.remove();
  });

  it("renders as a floating overlay container", async () => {
    const { wrapper, view, mountNode } = mountBarWithSelection(1, 6);
    await nextTick();

    expect(wrapper.get(".find-bar").classes()).toContain("find-bar--floating");

    wrapper.unmount();
    view.destroy();
    mountNode.remove();
  });

  it("finds next and previous in source mode", async () => {
    const { wrapper, getSelection } = mountBarWithSourceSelection(0, 5);
    await nextTick();

    expect((wrapper.find("input.find-bar__input").element as HTMLInputElement).value).toBe("alpha");

    const queryInput = wrapper.find("input.find-bar__input");
    await queryInput.trigger("keydown", { key: "Enter" });
    await nextTick();
    expect(getSelection()).toEqual({ start: 11, end: 16 });

    await queryInput.trigger("keydown", { key: "Enter", shiftKey: true });
    await nextTick();
    expect(getSelection()).toEqual({ start: 0, end: 5 });
  });
});
