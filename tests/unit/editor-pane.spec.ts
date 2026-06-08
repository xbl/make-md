import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { TextSelection } from "prosemirror-state";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";
import EditorPane from "@/components/EditorPane.vue";
import { useDocumentsStore } from "@/stores/documents";
import { useEditorStore } from "@/stores/editor";
import { useUiStore } from "@/stores/ui";

describe("EditorPane", () => {
  it("shows a markdown source editor in source mode and syncs edits back to the session", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    const ui = useUiStore();

    const session = documents.createNewDocument();
    session.updateContent("# Hello\n\nWorld");
    ui.toggleSourceMode();

    const wrapper = mount(EditorPane, {
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.classes()).toContain("editor-pane--source");

    const editor = wrapper.find("[data-testid='source-editor']");
    expect(editor.exists()).toBe(true);
    expect(editor.text()).toContain("# Hello");
    expect(wrapper.find("[data-testid='source-gutter']").text()).toContain("1");
    expect(wrapper.find("[data-testid='source-gutter']").text()).toContain("3");
    expect(wrapper.find("[data-testid='source-highlight']").html()).toContain("hljs");

    const input = wrapper.find("[data-testid='source-input']");
    await input.setValue("# Updated");

    expect(documents.activeSession?.content).toBe("# Updated");
  });

  it("supports find-next in source mode through the shared find bar", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    const ui = useUiStore();

    const session = documents.createNewDocument();
    session.updateContent("alpha beta alpha");
    ui.toggleSourceMode();

    const wrapper = mount(EditorPane, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    ui.openFindReplace("find");
    await nextTick();

    const sourceInput = wrapper.find("[data-testid='source-input']").element as HTMLTextAreaElement;
    sourceInput.focus();
    sourceInput.selectionStart = 0;
    sourceInput.selectionEnd = 5;

    const findInput = wrapper.find(".find-bar__input");
    await findInput.setValue("alpha");
    await findInput.trigger("keydown", { key: "Enter" });
    await nextTick();

    expect(sourceInput.selectionStart).toBe(11);
    expect(sourceInput.selectionEnd).toBe(16);
  });

  it("updates the rich editor when an open session is refreshed externally", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();

    const session = documents.createNewDocument();
    session.markSaved("first");

    const wrapper = mount(EditorPane, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await nextTick();
    expect(wrapper.text()).toContain("first");

    session.markSaved("second");
    documents.sessions = [...documents.sessions];
    await nextTick();
    await nextTick();

    expect(wrapper.text()).toContain("second");
    expect(wrapper.text()).not.toContain("first");
  });

  it("shows the AI toolbar only for a non-empty rich-text selection", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    const editorStore = useEditorStore();

    const session = documents.createNewDocument();
    session.markSaved("alpha beta");

    const wrapper = mount(EditorPane, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await nextTick();
    await nextTick();

    expect(wrapper.find("[data-testid='ai-edit-toolbar']").exists()).toBe(false);

    const view = editorStore.view;
    expect(view).toBeTruthy();
    if (!view) {
      throw new Error("expected editor view");
    }

    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 6)));
    await nextTick();

    expect(wrapper.find("[data-testid='ai-edit-toolbar']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='ai-edit-toolbar']").text()).toContain("Polish");
  });

  it("does not show the AI toolbar in source mode", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const documents = useDocumentsStore();
    const ui = useUiStore();

    const session = documents.createNewDocument();
    session.updateContent("alpha beta");
    ui.toggleSourceMode();

    const wrapper = mount(EditorPane, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    await nextTick();

    const sourceInput = wrapper.find("[data-testid='source-input']").element as HTMLTextAreaElement;
    sourceInput.focus();
    sourceInput.selectionStart = 0;
    sourceInput.selectionEnd = 5;
    sourceInput.dispatchEvent(new Event("select"));
    await nextTick();

    expect(wrapper.find("[data-testid='ai-edit-toolbar']").exists()).toBe(false);
  });
});
