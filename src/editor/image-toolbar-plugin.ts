import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { resetImageSize, setImageAlign } from "@/lib/image-commands";

export const imageToolbarKey = new PluginKey<{ imagePos: number | null }>("imageToolbar");

function buildToolbarDom(): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = "editor-toolbar";
  bar.style.display = "none";

  const sizeLabel = document.createElement("span");
  sizeLabel.className = "editor-toolbar__size";
  bar.appendChild(sizeLabel);

  const alignDefs = [
    { align: "inline", label: "Inline" },
    { align: "left", label: "Left" },
    { align: "center", label: "Center" },
    { align: "right", label: "Right" },
  ];
  for (const { align, label } of alignDefs) {
    const btn = document.createElement("button");
    btn.className = "editor-toolbar__btn";
    btn.dataset.align = align;
    btn.textContent = label;
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
    });
    bar.appendChild(btn);
  }

  const resetBtn = document.createElement("button");
  resetBtn.className = "editor-toolbar__btn";
  resetBtn.textContent = "Reset Size";
  resetBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
  bar.appendChild(resetBtn);

  return bar;
}

function positionBar(bar: HTMLDivElement, view: EditorView, pos: number) {
  try {
    const start = view.coordsAtPos(pos);
    const node = view.state.doc.nodeAt(pos);
    const end = node ? view.coordsAtPos(pos + node.nodeSize) : start;
    const editorBox = view.dom.getBoundingClientRect();
    const center = (start.left + end.right) / 2 - editorBox.left;
    bar.style.left = `${Math.max(8, center)}px`;
    bar.style.top = `${Math.max(0, start.top - editorBox.top - bar.offsetHeight - 8)}px`;
    bar.style.display = "";
  } catch {
    bar.style.display = "none";
  }
}

function refreshSizeLabel(bar: HTMLDivElement, view: EditorView, pos: number) {
  const node = view.state.doc.nodeAt(pos);
  if (!node) return;
  const w = node.attrs.width ?? "natural";
  const h = node.attrs.height ?? "natural";
  const label = bar.querySelector(".editor-toolbar__size") as HTMLSpanElement | null;
  if (label) label.textContent = `${w} × ${h}`;
}

function isImageNode(node: { type: { name: string } } | null | undefined): boolean {
  return node?.type.name === "image";
}

export function createImageToolbarPlugin() {
  let bar: HTMLDivElement | null = null;

  function attachBarEvents(view: EditorView) {
    if (!bar) return;
    bar.querySelectorAll<HTMLButtonElement>("[data-align]").forEach((btn) => {
      btn.onclick = () => {
        const pos = Number(bar?.dataset.imagePos);
        if (pos != null && isImageNode(view.state.doc.nodeAt(pos))) {
          setImageAlign(view, pos, btn.dataset.align!);
          if (bar) positionBar(bar, view, pos);
        }
      };
    });
    const resetBtn = bar.querySelector<HTMLButtonElement>(".editor-toolbar__btn:not([data-align])");
    if (resetBtn) {
      resetBtn.onclick = () => {
        const pos = Number(bar?.dataset.imagePos);
        if (pos != null && isImageNode(view.state.doc.nodeAt(pos))) {
          resetImageSize(view, pos);
          if (bar) {
            refreshSizeLabel(bar, view, pos);
            positionBar(bar, view, pos);
          }
        }
      };
    }
  }

  let editorView: EditorView;

  const onEditorClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const container = target?.closest?.(".md-image-container");
    if (!container) return;
    const img = container.querySelector("img");
    if (!img) return;
    try {
      const pos = editorView.posAtDOM(img, 0);
      if (isImageNode(editorView.state.doc.nodeAt(pos)) && bar) {
        bar.dataset.imagePos = String(pos);
        positionBar(bar, editorView, pos);
        refreshSizeLabel(bar, editorView, pos);
      }
    } catch {
      // ignore
    }
  };

  const onDocumentClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target?.closest?.(".md-image-container")) return;
    if (target?.closest?.(".editor-toolbar")) return;
    if (bar) bar.style.display = "none";
  };

  return new Plugin({
    key: imageToolbarKey,
    view(ev) {
      editorView = ev;
      bar = buildToolbarDom();
      editorView.dom.parentElement?.appendChild(bar);
      attachBarEvents(editorView);

      editorView.dom.addEventListener("click", onEditorClick);
      document.addEventListener("click", onDocumentClick);

      return {
        destroy() {
          document.removeEventListener("click", onDocumentClick);
          editorView.dom.removeEventListener("click", onEditorClick);
          bar?.remove();
          bar = null;
        },
      };
    },
  });
}
