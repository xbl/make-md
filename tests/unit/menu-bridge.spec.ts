import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it, vi } from "vitest";

const listenMock = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

describe("menu bridge", () => {
  it("forwards native menu commands to the provided handler", async () => {
    const unlisten = vi.fn();
    let handler: ((event: { payload: string }) => void) | undefined;
    listenMock.mockImplementation(async (_eventName: string, cb: typeof handler) => {
      handler = cb;
      return unlisten;
    });

    const { startMenuBridge } = await import("@/lib/menu-bridge");
    const runCommand = vi.fn();

    setActivePinia(createPinia());

    const stop = await startMenuBridge(runCommand);
    handler?.({ payload: "app.preferences" });
    handler?.({ payload: "file.open" });

    expect(runCommand).toHaveBeenCalledWith("app.preferences");
    expect(runCommand).toHaveBeenCalledWith("file.open");

    stop();
    expect(unlisten).toHaveBeenCalled();
  });
});
