import { Plugin } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import { markdownSchema } from "@/editor/schema";
import { copyImageAsset, copyImageBytes } from "@/lib/image-assets";

type ImageAssetOptions = {
  getDocPath: () => string | undefined;
  onError: (message: string) => void;
};

export async function insertImage(view: EditorView, src: string, alt = "image") {
  const { from } = view.state.selection;
  const node = markdownSchema.nodes.image.create({ src, alt, title: alt });
  view.dispatch(view.state.tr.insert(from, node));
}

export function createImageAssetPlugin(options: ImageAssetOptions) {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const item = Array.from(event.clipboardData?.items ?? []).find((entry) =>
          entry.type.startsWith("image/"),
        );
        if (!item) {
          return false;
        }

        const docPath = options.getDocPath();
        if (!docPath) {
          options.onError("Save the document before inserting images.");
          return false;
        }

        event.preventDefault();
        const file = item.getAsFile();
        if (!file) {
          return false;
        }

        void file
          .arrayBuffer()
          .then(async (buffer) => {
            const ext = file.type.split("/")[1] || "png";
            const src = await copyImageBytes(docPath, Array.from(new Uint8Array(buffer)), ext);
            await insertImage(view, src, file.name);
          })
          .catch((error) => options.onError(String(error)));

        return true;
      },
      handleDrop(view, event) {
        const docPath = options.getDocPath();
        if (!docPath) {
          options.onError("Save the document before inserting images.");
          return false;
        }

        const file = Array.from(event.dataTransfer?.files ?? []).find((entry) =>
          entry.type.startsWith("image/"),
        );
        if (!file) {
          return false;
        }

        event.preventDefault();
        const filePath = (file as File & { path?: string }).path;

        void (async () => {
          try {
            const src = filePath
              ? await copyImageAsset(docPath, filePath)
              : await copyImageBytes(
                  docPath,
                  Array.from(new Uint8Array(await file.arrayBuffer())),
                  file.type.split("/")[1] || "png",
                );
            await insertImage(view, src, file.name);
          } catch (error) {
            options.onError(String(error));
          }
        })();

        return true;
      },
    },
  });
}
