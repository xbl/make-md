import { ask } from "@tauri-apps/plugin-dialog";
import { isTauri } from "@tauri-apps/api/core";

export type ExternalChangeAction = "reload" | "keep" | "cancel";

export async function promptExternalChange(fileName: string): Promise<ExternalChangeAction> {
  if (!isTauri()) {
    return "keep";
  }

  const reload = await ask(
    `"${fileName}" was modified by another program. Reload from disk and discard your local changes?`,
    { title: "File Changed Externally", kind: "warning" },
  );
  if (reload) {
    return "reload";
  }

  const keep = await ask(
    `Keep your unsaved version of "${fileName}"? Saving later will overwrite the external changes.`,
    { title: "Keep Local Version", kind: "warning" },
  );
  return keep ? "keep" : "cancel";
}
