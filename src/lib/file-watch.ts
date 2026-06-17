import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type FileChangeKind = "modified" | "removed";

export type FileChangePayload = {
  path: string;
  kind: FileChangeKind;
};

export async function watchFile(path: string): Promise<void> {
  if (!isTauri()) {
    return;
  }
  await invoke("watch_file", { path });
}

export async function unwatchFile(path: string): Promise<void> {
  if (!isTauri()) {
    return;
  }
  await invoke("unwatch_file", { path });
}

export async function onFileChanged(
  handler: (payload: FileChangePayload) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) {
    return () => {};
  }
  return listen<FileChangePayload>("file://changed", (event) => {
    handler(event.payload);
  });
}
