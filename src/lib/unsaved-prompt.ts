import { ask } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";

export type UnsavedAction = "save" | "discard" | "cancel";

export async function promptUnsavedChanges(fileName: string): Promise<UnsavedAction> {
  if (!isTauri()) {
    if (window.confirm(`Save changes to "${fileName}" before closing?`)) {
      return "save";
    }
    return window.confirm(`Discard unsaved changes to "${fileName}"?`) ? "discard" : "cancel";
  }

  const save = await ask(`Save changes to "${fileName}" before closing?`, {
    title: "Unsaved Changes",
    kind: "warning",
  });
  if (save) {
    return "save";
  }

  const discard = await ask(`Discard unsaved changes to "${fileName}"?`, {
    title: "Discard Changes",
    kind: "warning",
  });
  return discard ? "discard" : "cancel";
}
