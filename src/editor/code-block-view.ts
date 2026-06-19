import type { Node as PMNode } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";

export function createCodeBlockNodeView(
  node: PMNode,
  view: EditorView,
  getPos: () => number | undefined,
): NodeView {
  const wrapper = document.createElement("div");
  wrapper.className = "code-block-wrapper";
  const controls = document.createElement("div");
  controls.className = "code-block-controls";
  const languageTrigger = document.createElement("button");
  languageTrigger.type = "button";
  languageTrigger.className = "code-block-language-trigger";
  const languageInput = document.createElement("input");
  languageInput.type = "text";
  languageInput.className = "code-block-language-input";
  languageInput.placeholder = "language";
  languageInput.hidden = true;
  controls.appendChild(languageTrigger);
  controls.appendChild(languageInput);

  const pre = document.createElement("pre");
  const code = document.createElement("code");
  pre.appendChild(code);

  const overlay = document.createElement("div");
  overlay.className = "hljs-overlay";
  overlay.setAttribute("aria-hidden", "true");
  wrapper.appendChild(controls);

  wrapper.appendChild(overlay);
  wrapper.appendChild(pre);

  function isOverlayMutationTarget(target: Node) {
    return target instanceof Element && target.closest(".hljs-overlay");
  }

  function isWrapperMutationTarget(target: Node) {
    return target === wrapper;
  }

  function languageLabel(language: string) {
    return language || "plain text";
  }

  function syncLanguage(language: string) {
    const normalized = language.trim();
    languageInput.value = normalized;
    languageTrigger.textContent = languageLabel(normalized);
    if (normalized) {
      pre.dataset.params = normalized;
      wrapper.dataset.language = normalized;
    } else {
      delete pre.dataset.params;
      delete wrapper.dataset.language;
      delete wrapper.dataset.highlighted;
    }
  }
  function startLanguageEdit() {
    languageInput.hidden = false;
    languageTrigger.hidden = true;
    languageInput.focus();
    languageInput.select();
  }

  function finishLanguageEdit() {
    languageInput.hidden = true;
    languageTrigger.hidden = false;
    view.focus();
  }

  function commitLanguage(rawLanguage: string) {
    const position = getPos();
    if (typeof position !== "number") {
      return;
    }
    const currentNode = view.state.doc.nodeAt(position);
    if (!currentNode || currentNode.type.name !== "code_block") {
      return;
    }

    const nextLanguage = rawLanguage.trim();
    syncLanguage(nextLanguage);
    view.dispatch(view.state.tr.setNodeMarkup(position, currentNode.type, {
      ...currentNode.attrs,
      params: nextLanguage,
    }));
  }

  languageTrigger.addEventListener("click", () => startLanguageEdit());
  languageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitLanguage(languageInput.value);
      finishLanguageEdit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      const language = wrapper.dataset.language ?? "";
      syncLanguage(language);
      finishLanguageEdit();
    }
  });
  languageInput.addEventListener("blur", () => {
    commitLanguage(languageInput.value);
    finishLanguageEdit();
  });

  syncLanguage(node.attrs.params ?? "");

  return {
    dom: wrapper,
    contentDOM: code,
    update(updatedNode) {
      if (updatedNode.type.name !== "code_block") {
        return false;
      }
      const lang = updatedNode.attrs.params ?? "";
      if ((wrapper.dataset.language ?? "") !== lang.trim()) {
        syncLanguage(lang);
      }
      return true;
    },
    stopEvent(event) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return false;
      }
      return controls.contains(target);
    },
    ignoreMutation(mutation): boolean {
      return !!(
        controls.contains(mutation.target) ||
        isOverlayMutationTarget(mutation.target) ||
        isWrapperMutationTarget(mutation.target)
      );
    },
  };
}

export function createEditorNodeViews() {
  return {
    code_block: createCodeBlockNodeView,
  };
}
