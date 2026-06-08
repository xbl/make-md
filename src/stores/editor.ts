import { defineStore } from "pinia";
import type { EditorView } from "prosemirror-view";
import { ref, shallowRef } from "vue";

export type SourceEditorAdapter = {
  getValue: () => string;
  getSelection: () => { start: number; end: number };
  setSelection: (start: number, end: number) => void;
  replaceSelection: (nextValue: string, selectionStart: number, selectionEnd: number) => void;
  focus: () => void;
};

export const useEditorStore = defineStore("editor", () => {
  const view = shallowRef<EditorView | null>(null);
  const sourceEditor = shallowRef<SourceEditorAdapter | null>(null);
  const docVersion = ref(0);

  function setView(nextView: EditorView | null) {
    view.value = nextView;
    if (nextView) {
      docVersion.value += 1;
    }
  }

  function bumpDocVersion() {
    docVersion.value += 1;
  }

  function clearView() {
    view.value = null;
  }

  function setSourceEditor(adapter: SourceEditorAdapter | null) {
    sourceEditor.value = adapter;
  }

  return {
    view,
    sourceEditor,
    docVersion,
    setView,
    setSourceEditor,
    bumpDocVersion,
    clearView,
  };
});
