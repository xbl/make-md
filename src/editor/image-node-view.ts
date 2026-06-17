import type { Node as PMNode } from "prosemirror-model";
import type { EditorView, NodeView } from "prosemirror-view";

const HANDLE_POSITIONS = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const;

function createHandleDiv(position: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = `md-image-handle md-image-handle--${position}`;
  return el;
}

export function createImageNodeView(
  node: PMNode,
  view: EditorView,
  getPos: () => number | undefined,
): NodeView {
  const container = document.createElement("div");
  container.className = "md-image-container";

  const wrapper = document.createElement("div");
  wrapper.className = "md-image-wrapper";

  const img = document.createElement("img");

  function syncImg(nextNode: PMNode) {
    img.src = String(nextNode.attrs.displaySrc ?? nextNode.attrs.src ?? "");
    img.alt = String(nextNode.attrs.alt ?? "");
    if (nextNode.attrs.title) {
      img.title = String(nextNode.attrs.title);
    } else {
      img.removeAttribute("title");
    }
    // Apply explicit width/height if set
    if (nextNode.attrs.width != null) {
      img.style.width = `${nextNode.attrs.width}px`;
      img.style.height = "auto";
    } else {
      img.style.width = "";
    }
    if (nextNode.attrs.height != null) {
      img.style.height = `${nextNode.attrs.height}px`;
    } else if (nextNode.attrs.width == null) {
      img.style.height = "";
    }
    // Alignment class
    const align = nextNode.attrs.align || "inline";
    container.className = `md-image-container md-image--align-${align}`;
  }

  syncImg(node);

  // Build DOM
  wrapper.appendChild(img);
  for (const pos of HANDLE_POSITIONS) {
    wrapper.appendChild(createHandleDiv(pos));
  }
  container.appendChild(wrapper);

  // Selection state
  let selected = false;

  function setSelected(value: boolean) {
    selected = value;
    if (selected) {
      container.classList.add("md-image-container--selected");
    } else {
      container.classList.remove("md-image-container--selected");
    }
  }

  container.addEventListener("click", (event) => {
    event.stopPropagation();
    event.preventDefault();
    setSelected(true);
  });

  // Document-level click to deselect
  function onDocClick(event: MouseEvent) {
    if (!container.contains(event.target as Node)) {
      setSelected(false);
    }
  }
  document.addEventListener("click", onDocClick);

  // Resize handle drag
  let draggingHandle: string | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartWidth = 0;
  let dragStartHeight = 0;
  let dragNaturalWidth = 0;
  let dragNaturalHeight = 0;

  function onHandleMouseDown(event: MouseEvent, position: string) {
    event.preventDefault();
    event.stopPropagation();
    draggingHandle = position;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragStartWidth = img.offsetWidth;
    dragStartHeight = img.offsetHeight;
    dragNaturalWidth = img.naturalWidth;
    dragNaturalHeight = img.naturalHeight;
    document.addEventListener("mousemove", onHandleMouseMove);
    document.addEventListener("mouseup", onHandleMouseUp);
  }

  function onHandleMouseMove(event: MouseEvent) {
    if (!draggingHandle) return;
    const dx = event.clientX - dragStartX;
    const dy = event.clientY - dragStartY;
    let newWidth = dragStartWidth;
    let newHeight = dragStartHeight;

    if (draggingHandle.includes("e")) newWidth = Math.max(20, dragStartWidth + dx);
    if (draggingHandle.includes("w")) newWidth = Math.max(20, dragStartWidth - dx);
    if (draggingHandle.includes("s")) newHeight = Math.max(20, dragStartHeight + dy);
    if (draggingHandle.includes("n")) newHeight = Math.max(20, dragStartHeight - dy);

    // Corner handles maintain aspect ratio
    if (draggingHandle.length === 2 && dragNaturalWidth > 0 && dragNaturalHeight > 0) {
      const ratio = dragNaturalWidth / dragNaturalHeight;
      if (draggingHandle === "nw" || draggingHandle === "se") {
        newHeight = newWidth / ratio;
      } else {
        newWidth = newHeight * ratio;
      }
    }

    img.style.width = `${newWidth}px`;
    img.style.height = `${newHeight}px`;
  }

  function onHandleMouseUp() {
    if (!draggingHandle) return;
    document.removeEventListener("mousemove", onHandleMouseMove);
    document.removeEventListener("mouseup", onHandleMouseUp);
    const pos = getPos();
    if (pos != null && view.state.doc.nodeAt(pos)?.type.name === "image") {
      const newWidth = Math.round(parseFloat(img.style.width) || img.offsetWidth);
      const newHeight = Math.round(parseFloat(img.style.height) || img.offsetHeight);
      const tr = view.state.tr.setNodeMarkup(pos, null, {
        ...view.state.doc.nodeAt(pos)!.attrs,
        width: newWidth,
        height: newHeight,
      });
      view.dispatch(tr);
    }
    draggingHandle = null;
  }

  // Attach handle listeners
  for (const child of wrapper.querySelectorAll<HTMLDivElement>(".md-image-handle")) {
    const position = child.className.match(/md-image-handle--(\w+)/)?.[1];
    if (position) {
      child.addEventListener("mousedown", (e) => onHandleMouseDown(e, position));
    }
  }

  return {
    dom: container,
    update(updatedNode) {
      if (updatedNode.type.name !== "image") return false;
      syncImg(updatedNode);
      return true;
    },
    destroy() {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("mousemove", onHandleMouseMove);
      document.removeEventListener("mouseup", onHandleMouseUp);
    },
    stopEvent(event) {
      if ((event.target as HTMLElement)?.closest?.(".md-image-handle")) {
        return true;
      }
      return false;
    },
    ignoreMutation() {
      // No contentDOM: the NodeView owns its entire DOM subtree.
      // ProseMirror should never try to reconcile mutations here;
      // the update() method handles all attribute syncing from transactions.
      return true;
    },
  };
}
