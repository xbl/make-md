import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export async function startAiStream(requestId: string, payload: Record<string, unknown>) {
  const chunks: string[] = [];

  const unlistenChunk = await listen<{ delta: string }>(`ai://chunk/${requestId}`, (event) => {
    chunks.push(event.payload.delta);
  });

  const unlistenDone = await listen(`ai://done/${requestId}`, async () => {
    await unlistenChunk();
    await unlistenDone();
  });

  await invoke("ai_stream", payload);

  return {
    getText: () => chunks.join(""),
    cancel: () => invoke("ai_cancel", { requestId }),
  };
}
