import { reactive } from "vue";

export type ContextMenuActionItem = {
  type: "action";
  id: string;
  label: string;
  disabled?: boolean;
  shortcut?: string;
};

export type ContextMenuSeparatorItem = {
  type: "separator";
  id: string;
};

export type ContextMenuItem = ContextMenuActionItem | ContextMenuSeparatorItem;

export type ContextMenuCloseReason = "escape" | "click-away" | "select" | "programmatic";

export type ContextMenuState = {
  open: boolean;
  x: number;
  y: number;
};

export function createContextMenuController(initial?: Partial<ContextMenuState>) {
  const state = reactive<ContextMenuState>({
    open: initial?.open ?? false,
    x: initial?.x ?? 0,
    y: initial?.y ?? 0,
  });

  function openAt(x: number, y: number) {
    state.open = true;
    state.x = x;
    state.y = y;
  }

  function close(_reason: ContextMenuCloseReason = "programmatic") {
    state.open = false;
  }

  return {
    state,
    openAt,
    close,
  };
}

export function isContextMenuActionItem(item: ContextMenuItem): item is ContextMenuActionItem {
  return item.type === "action";
}
