import { isTauri } from "@tauri-apps/api/core";
import { resolveImageAbsolutePath } from "@/lib/image-assets";
import type { EditorView } from "prosemirror-view";

export type ImageAction =
  | "copyImage"
  | "copyPath"
  | "saveAs"
  | "revealInFinder"
  | "resetSize"
  | "setAlignInline"
  | "setAlignLeft"
  | "setAlignCenter"
  | "setAlignRight";

interface ImageNodeInfo {
  pos: number;
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  align: string;
  displaySrc: string | null;
}

function mimeTypeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
  };
  return map[ext ?? ""] ?? "image/png";
}

export function findImageAtClick(
  view: EditorView,
  event: MouseEvent,
): { pos: number; info: ImageNodeInfo } | null {
  const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
  if (pos == null) return null;
  const node = view.state.doc.nodeAt(pos.pos);
  if (node?.type.name === "image") {
    return {
      pos: pos.pos,
      info: {
        pos: pos.pos,
        src: node.attrs.src,
        alt: node.attrs.alt ?? "",
        width: node.attrs.width,
        height: node.attrs.height,
        align: node.attrs.align ?? "inline",
        displaySrc: node.attrs.displaySrc,
      },
    };
  }
  return null;
}

export async function copyImageToClipboard(
  docPath: string | undefined,
  src: string,
): Promise<void> {
  const absPath = resolveImageAbsolutePath(docPath, src);
  if (!absPath) {
    throw new Error("Cannot copy remote images");
  }

  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = await invoke<number[]>("read_binary_file", { path: absPath });
    const mimeType = mimeTypeFromPath(absPath);
    const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
    await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })]);
  } else {
    const response = await fetch(`file://${encodeURI(absPath)}`);
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
  }
}

export function copyImageMarkdownPath(info: { alt: string; src: string }): void {
  void navigator.clipboard.writeText(`![${info.alt}](${info.src})`);
}

export async function saveImageAs(
  docPath: string | undefined,
  src: string,
): Promise<void> {
  const absPath = resolveImageAbsolutePath(docPath, src);
  if (!absPath) throw new Error("Cannot save remote images");
  if (!isTauri()) throw new Error("Save As is only available in the desktop app");

  const { save } = await import("@tauri-apps/plugin-dialog");
  const fileName = src.split("/").pop() ?? "image.png";
  const destPath = await save({
    defaultPath: fileName,
    filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp"] }],
  });
  if (!destPath) return;

  const { invoke } = await import("@tauri-apps/api/core");
  const bytes = await invoke<number[]>("read_binary_file", { path: absPath });
  await invoke("write_binary_file", { path: destPath, bytes });
}

export async function revealImageInFinder(
  docPath: string | undefined,
  src: string,
): Promise<void> {
  const absPath = resolveImageAbsolutePath(docPath, src);
  if (!absPath) throw new Error("Cannot reveal remote images");
  if (!isTauri()) throw new Error("Reveal in Finder is only available in the desktop app");

  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("reveal_in_finder", { path: absPath });
}

export function resetImageSize(view: EditorView, pos: number): void {
  const node = view.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "image") return;
  view.dispatch(
    view.state.tr.setNodeMarkup(pos, null, {
      ...node.attrs,
      width: null,
      height: null,
    }),
  );
}

export function setImageAlign(view: EditorView, pos: number, align: string): void {
  const node = view.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "image") return;
  view.dispatch(
    view.state.tr.setNodeMarkup(pos, null, {
      ...node.attrs,
      align,
    }),
  );
}
