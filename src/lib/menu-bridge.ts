import { isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export async function startMenuBridge(runCommand: (commandId: string) => void | Promise<void>): Promise<() => void> {
  if (!isTauri()) {
    return () => {};
  }

  const unlisten: UnlistenFn = await listen<string>("app://menu-command", (event) => {
    void runCommand(event.payload);
  });

  return () => {
    unlisten();
  };
}
