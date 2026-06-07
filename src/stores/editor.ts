import { defineStore } from "pinia";
import type { EditorView } from "prosemirror-view";
import { ref, shallowRef } from "vue";

export const useEditorStore = defineStore("editor", () => {
  const view = shallowRef<EditorView | null>(null);
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

  return {
    view,
    docVersion,
    setView,
    bumpDocVersion,
    clearView,
  };
});
