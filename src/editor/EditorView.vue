<template>
  <div class="editor-view-shell" @contextmenu="openContextMenu">
    <AiEditToolbar
      v-if="selectionToolbar.visible"
      :left="selectionToolbar.left"
      :top="selectionToolbar.top"
    />
    <div ref="mountRef" class="editor-view"></div>
    <TableControlsOverlay
      :visible="tableOverlay.visible"
      :left="tableOverlay.left"
      :top="tableOverlay.top"
      :width="tableOverlay.width"
      :height="tableOverlay.height"
      :row-index="tableOverlay.rowIndex"
      :column-index="tableOverlay.columnIndex"
      :row-count="tableOverlay.rowCount"
      :column-count="tableOverlay.columnCount"
      :cell-rect="tableOverlay.cellRect"
      @action="handleTableAction"
    />
    <ContextMenu
      :open="menu.state.open"
      :x="menu.state.x"
      :y="menu.state.y"
      :items="menuItems"
      @close="menu.close"
      @select="handleMenuSelect"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { EditorState, NodeSelection, TextSelection } from "prosemirror-state";
import { EditorView as PMEditorView } from "prosemirror-view";
import type { EditorState as PMEditorState } from "prosemirror-state";
import type { Slice } from "prosemirror-model";
import AiEditToolbar from "@/components/AiEditToolbar.vue";
import ContextMenu from "@/components/ContextMenu.vue";
import TableControlsOverlay from "@/editor/TableControlsOverlay.vue";
import { getActiveTableContext, applyTableAction, type TableAction, type ActiveTableContext } from "@/editor/table-editing";
import { markdownSchema } from "@/editor/schema";
import { parseMarkdown } from "@/editor/markdown-parser";
import { serializeMarkdown } from "@/editor/markdown-serializer";
import { createEditorPlugins } from "@/editor/plugins";
import { createEditorNodeViews } from "@/editor/code-block-view";
import { createImageNodeView } from "@/editor/image-node-view";
import {
  createContextMenuController,
  type ContextMenuActionItem,
  type ContextMenuItem,
} from "@/lib/context-menu";
import { useDocumentsStore } from "@/stores/documents";
import { useEditorStore } from "@/stores/editor";
import { convertSvgToPngBlob } from "@/lib/image-helpers";
import { findImageAtClick, copyImageToClipboard, copyImageMarkdownPath, saveImageAs, revealImageInFinder } from "@/lib/image-commands";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();
const rightClickedSvg = ref<string | null>(null);
const rightClickedImage = ref<{ src: string; alt: string; docPath: string | undefined } | null>(null);
let pendingImageContext: { src: string; alt: string; docPath: string | undefined } | null = null;

const tableOverlay = ref({
  visible: false,
  left: 0,
  top: 0,
  width: 0,
  height: 0,
  rowIndex: 0,
  columnIndex: 0,
  rowCount: 0,
  columnCount: 0,
  cellRect: { left: 0, top: 0, width: 0, height: 0 },
});

const mountRef = ref<HTMLDivElement | null>(null);
const documents = useDocumentsStore();
const editorStore = useEditorStore();
const menu = createContextMenuController();
let view: PMEditorView | null = null;
const selectionToolbar = ref({
  visible: false,
  left: 0,
  top: 0,
});

const activeSession = computed(() => documents.activeSession);
const hasSelection = computed(() => Boolean(view && !view.state.selection.empty));
const canUseClipboard = computed(() => Boolean(window.navigator?.clipboard));

const menuItems = computed<ContextMenuItem[]>(() => {
  const items: ContextMenuItem[] = [];

  // Image items come first
  if (rightClickedImage.value) {
    items.push(
      { type: "action", id: "image.copyImage", label: t("menu.image.copyImage") },
      { type: "action", id: "image.copyPath", label: t("menu.image.copyPath") },
      { type: "action", id: "image.saveAs", label: t("menu.image.saveAs") },
      { type: "action", id: "image.revealInFinder", label: t("menu.image.revealInFinder") },
      { type: "separator", id: "sep-image" },
    );
  }

  // Mermaid items next
  if (rightClickedSvg.value) {
    items.push(
      { type: "action", id: "mermaid.copyPng", label: t("editor.menu.copyMermaidPng") },
      { type: "separator", id: "sep-mermaid" },
    );
  }

  // Standard items
  items.push(
    { type: "action", id: "clipboard.cut", label: "Cut", disabled: !hasSelection.value },
    { type: "action", id: "clipboard.copy", label: "Copy", disabled: !hasSelection.value },
    { type: "action", id: "clipboard.paste", label: "Paste", disabled: !canUseClipboard.value },
    { type: "action", id: "edit.selectAll", label: "Select All" },
    { type: "separator", id: "sep-edit-format" },
    { type: "action", id: "format.bold", label: "Bold" },
    { type: "action", id: "format.italic", label: "Italic" },
    { type: "action", id: "format.inlineCode", label: "Inline Code" },
    { type: "separator", id: "sep-format-paragraph" },
    { type: "action", id: "paragraph.h1", label: "Heading 1" },
    { type: "action", id: "paragraph.h2", label: "Heading 2" },
    { type: "action", id: "paragraph.h3", label: "Heading 3" },
    { type: "action", id: "paragraph.paragraph", label: "Paragraph" },
    { type: "separator", id: "sep-paragraph-table" },
    { type: "action", id: "paragraph.table", label: "Insert Table" },
  );

  return items;
});

function dispatchEditorCommand(commandId: string) {
  window.dispatchEvent(new CustomEvent("make-md:editor-command", { detail: { commandId } }));
}

function serializeSelectionForClipboard(state: PMEditorState) {
  let result = "";
  state.plugins.some((plugin) => {
    const serializer = plugin.props.clipboardTextSerializer;
    if (typeof serializer !== "function") {
      return false;
    }
    if (!view) {
      return false;
    }
    result = serializer.call(plugin, state.selection.content(), view);
    return true;
  });
  return result;
}

async function copySelection() {
  if (!view || view.state.selection.empty || !window.navigator?.clipboard) {
    return;
  }
  const text = serializeSelectionForClipboard(view.state);
  if (!text) {
    return;
  }
  await window.navigator.clipboard.writeText(text);
}

async function cutSelection() {
  if (!view || view.state.selection.empty || !window.navigator?.clipboard) {
    return;
  }
  await copySelection();
  view.dispatch(view.state.tr.deleteSelection().scrollIntoView());
  view.focus();
}

async function pasteClipboard() {
  const currentView = view;
  if (!currentView || !window.navigator?.clipboard) {
    return;
  }
  const text = await window.navigator.clipboard.readText();
  if (!text) {
    return;
  }
  const handled = currentView.someProp("handlePaste", (handler) =>
    handler.call(
      currentView,
      currentView,
      {
        preventDefault() {},
        clipboardData: {
          items: [{ type: "text/plain" }],
          getData(type: string) {
            return type === "text/plain" ? text : "";
          },
        },
      } as unknown as ClipboardEvent,
      null as unknown as Slice,
    ),
  );
  if (!handled) {
    currentView.dispatch(currentView.state.tr.insertText(text).scrollIntoView());
  }
  currentView.focus();
}

async function handleMenuSelect(item: ContextMenuActionItem) {
  // Image commands
  if (item.id === "image.copyImage" && pendingImageContext) {
    try {
      await copyImageToClipboard(
        pendingImageContext.docPath,
        pendingImageContext.src,
      );
    } catch (error) {
      window.alert(String(error));
    }
    return;
  }
  if (item.id === "image.copyPath" && pendingImageContext) {
    copyImageMarkdownPath(pendingImageContext);
    return;
  }
  if (item.id === "image.saveAs" && pendingImageContext) {
    try {
      await saveImageAs(
        pendingImageContext.docPath,
        pendingImageContext.src,
      );
    } catch (error) {
      window.alert(String(error));
    }
    return;
  }
  if (item.id === "image.revealInFinder" && pendingImageContext) {
    try {
      await revealImageInFinder(
        pendingImageContext.docPath,
        pendingImageContext.src,
      );
    } catch (error) {
      window.alert(String(error));
    }
    return;
  }

  // Mermaid (existing)
  if (item.id === "mermaid.copyPng") {
    if (rightClickedSvg.value) {
      try {
        const pngPromise = convertSvgToPngBlob(rightClickedSvg.value);
        await window.navigator.clipboard.write([
          new ClipboardItem({ "image/png": pngPromise }),
        ]);
      } catch (error) {
        window.alert(error instanceof Error ? error.message : String(error));
      }
    }
    return;
  }

  if (item.id === "clipboard.cut") {
    await cutSelection();
    return;
  }
  if (item.id === "clipboard.copy") {
    await copySelection();
    return;
  }
  if (item.id === "clipboard.paste") {
    await pasteClipboard();
    return;
  }
  dispatchEditorCommand(item.id);
}

function openContextMenu(event: MouseEvent) {
  if (!view || !activeSession.value) {
    return;
  }
  event.preventDefault();

  const target = event.target as HTMLElement | null;

  // Check for image click first
  const imgEl = target?.closest?.(".md-image-container img") as HTMLImageElement | null;
  if (imgEl && view) {
    const result = findImageAtClick(view, event);
    if (result) {
      rightClickedImage.value = {
        src: result.info.src,
        alt: result.info.alt,
        docPath: activeSession.value?.path,
      };
      pendingImageContext = rightClickedImage.value;
    } else {
      rightClickedImage.value = null;
      pendingImageContext = null;
    }
  } else {
    rightClickedImage.value = null;
    pendingImageContext = null;
  }

  // Check for mermaid (existing logic)
  const container = target?.closest(".mermaid-preview.mermaid-preview--ready");
  if (container) {
    const svgEl = container.querySelector("svg");
    rightClickedSvg.value = svgEl ? svgEl.outerHTML : null;
  } else {
    rightClickedSvg.value = null;
  }

  view.focus();
  menu.openAt(event.clientX, event.clientY);
}

function hideSelectionToolbar() {
  selectionToolbar.value = {
    visible: false,
    left: 0,
    top: 0,
  };
}

function updateSelectionToolbar() {
  if (!view || !mountRef.value) {
    hideSelectionToolbar();
    return;
  }

  const { selection } = view.state;
  if (selection.empty || selection instanceof NodeSelection) {
    hideSelectionToolbar();
    return;
  }

  try {
    const start = view.coordsAtPos(selection.from);
    const end = view.coordsAtPos(selection.to);
    const container = mountRef.value.getBoundingClientRect();
    const selectionCenter = (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2;
    selectionToolbar.value = {
      visible: true,
      left: Math.max(16, selectionCenter - container.left),
      top: Math.max(8, Math.min(start.top, end.top) - container.top - 48),
    };
  } catch {
    selectionToolbar.value = {
      visible: true,
      left: 24,
      top: 8,
    };
  }
}

let activeContext: ActiveTableContext | null = null;

function updateTableOverlay() {
  if (!view || !mountRef.value) {
    tableOverlay.value.visible = false;
    activeContext = null;
    return;
  }

  activeContext = getActiveTableContext(view, mountRef.value.parentElement || mountRef.value);
  if (activeContext) {
    tableOverlay.value = {
      visible: true,
      left: activeContext.rect.left,
      top: activeContext.rect.top,
      width: activeContext.rect.width,
      height: activeContext.rect.height,
      rowIndex: activeContext.rowIndex,
      columnIndex: activeContext.columnIndex,
      rowCount: activeContext.rowCount,
      columnCount: activeContext.columnCount,
      cellRect: activeContext.cellRect,
    };
  } else {
    tableOverlay.value.visible = false;
    activeContext = null;
  }
}

function handleTableAction(action: TableAction) {
  if (view && activeContext) {
    applyTableAction(view, action, activeContext);
  }
}

function syncSessionContent() {
  const session = activeSession.value;
  if (!session || !view) {
    return;
  }
  const content = serializeMarkdown(view.state.doc);
  documents.scheduleAutosave(content);
}

function syncViewFromSession() {
  const session = activeSession.value;
  if (!session || !view) {
    return;
  }

  const currentContent = serializeMarkdown(view.state.doc);
  if (currentContent === session.content) {
    return;
  }

  const previousFrom = view.state.selection.from;
  const previousDocSize = view.state.doc.content.size;
  const fractionFromStart = previousDocSize > 0 ? previousFrom / previousDocSize : 0;

  const nextDoc = parseMarkdown(session.content || "", session.path || undefined);
  const nextDocSize = nextDoc.content.size;
  let targetPos = Math.min(previousFrom, nextDocSize);
  // If the doc shrank a lot, fall back to the same fractional position so the cursor
  // doesn't end up far past the end of meaningful content.
  if (targetPos === nextDocSize && previousFrom > nextDocSize) {
    targetPos = Math.max(0, Math.floor(fractionFromStart * nextDocSize));
  }

  const nextState = EditorState.create({
    schema: markdownSchema,
    doc: nextDoc,
    plugins: createEditorPlugins({
      getDocPath: () => activeSession.value?.path || undefined,
      onImageError: (message) => window.alert(message),
    }),
  });

  // Apply the preserved cursor position via a transaction on the fresh state.
  let stateWithSelection = nextState;
  try {
    const $pos = nextState.doc.resolve(Math.min(targetPos, nextState.doc.content.size));
    stateWithSelection = nextState.apply(
      nextState.tr.setSelection(TextSelection.near($pos)),
    );
  } catch {
    // Fall back silently if the position can't be resolved (e.g., empty doc).
  }

  const hadFocus = view.hasFocus();
  view.updateState(stateWithSelection);
  editorStore.bumpDocVersion();
  updateSelectionToolbar();
  updateTableOverlay();
  if (hadFocus) {
    view.focus();
  }
}

function mountEditor() {
  if (!mountRef.value || !activeSession.value) {
    editorStore.clearView();
    return;
  }

  const doc = parseMarkdown(activeSession.value.content || "", activeSession.value.path || undefined);
  const state = EditorState.create({
    schema: markdownSchema,
    doc,
    plugins: createEditorPlugins({
      getDocPath: () => activeSession.value?.path || undefined,
      onImageError: (message) => window.alert(message),
    }),
  });

  view?.destroy();
  view = new PMEditorView(mountRef.value, {
    state,
    nodeViews: {
      ...createEditorNodeViews(),
      image: createImageNodeView,
    },
    dispatchTransaction(transaction) {
      const nextState = view?.state.apply(transaction);
      if (!nextState || !view) {
        return;
      }
      view.updateState(nextState);
      updateSelectionToolbar();
      updateTableOverlay();
      if (transaction.docChanged) {
        editorStore.bumpDocVersion();
        syncSessionContent();
      }
    },
  });
  editorStore.setView(view);
  updateSelectionToolbar();
  updateTableOverlay();
  view.focus();
}

onMounted(async () => {
  await nextTick();
  mountEditor();
});

watch(
  () => activeSession.value?.id,
  async () => {
    await nextTick();
    mountEditor();
  },
);

watch(
  () => documents.sessions,
  async () => {
    await nextTick();
    syncViewFromSession();
  },
);

onBeforeUnmount(() => {
  void documents.flushAutosave();
  view?.destroy();
  view = null;
  hideSelectionToolbar();
  menu.close();
  tableOverlay.value.visible = false;
  activeContext = null;
  editorStore.clearView();
});
</script>
