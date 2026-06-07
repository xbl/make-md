import { invoke, isTauri } from "@tauri-apps/api/core";

const PREFIX = "make-md:recovery:";

export async function saveRecoverySnapshot(id: string, content: string) {
  if (!isTauri()) {
    localStorage.setItem(PREFIX + id, content);
    return;
  }
  await invoke("save_recovery_snapshot", { id, content });
}

export async function loadRecoverySnapshot(id: string): Promise<string | null> {
  if (!isTauri()) {
    return localStorage.getItem(PREFIX + id);
  }
  return invoke<string | null>("load_recovery_snapshot", { id });
}

export async function clearRecoverySnapshot(id: string) {
  if (!isTauri()) {
    localStorage.removeItem(PREFIX + id);
    return;
  }
  await invoke("clear_recovery_snapshot", { id });
}
