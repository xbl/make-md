import { invoke, isTauri } from "@tauri-apps/api/core";

const PREFIX = "make-md:recovery:";

function getStorage(): Storage | null {
  return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
}

export async function saveRecoverySnapshot(id: string, content: string) {
  if (!isTauri()) {
    getStorage()?.setItem(PREFIX + id, content);
    return;
  }
  await invoke("save_recovery_snapshot", { id, content });
}

export async function loadRecoverySnapshot(id: string): Promise<string | null> {
  if (!isTauri()) {
    return getStorage()?.getItem(PREFIX + id) ?? null;
  }
  return invoke<string | null>("load_recovery_snapshot", { id });
}

export async function clearRecoverySnapshot(id: string) {
  if (!isTauri()) {
    getStorage()?.removeItem(PREFIX + id);
    return;
  }
  await invoke("clear_recovery_snapshot", { id });
}
