import type { InjectionKey, Ref } from "vue";
import type { EditorView } from "prosemirror-view";

export type EditorContext = {
  view: Ref<EditorView | null>;
  docVersion: Ref<number>;
};

export const EditorViewKey: InjectionKey<EditorContext> = Symbol("editor-view");
