import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { vi } from "vitest";
import AppShell from "../../src/layout/AppShell.vue";
import { useUiStore } from "../../src/stores/ui";

describe("AppShell", () => {
  it("renders sidebar, editor pane, and status bar regions", () => {
    const wrapper = mount(AppShell, {
      global: {
        plugins: [createPinia()],
      },
    });

    expect(wrapper.find("[data-testid='sidebar']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='editor-pane']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='status-bar']").exists()).toBe(true);
  });

  it("does not close settings while shortcut capture handles Escape", async () => {
    const handlers: Array<(event: KeyboardEvent) => void | Promise<void>> = [];
    const addSpy = vi.spyOn(window, "addEventListener").mockImplementation((type, listener) => {
      if (type === "keydown" && typeof listener === "function") {
        handlers.push(listener as (event: KeyboardEvent) => void | Promise<void>);
      }
    });
    const removeSpy = vi.spyOn(window, "removeEventListener").mockImplementation(() => {});

    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();

    const wrapper = mount(AppShell, {
      global: {
        plugins: [pinia],
      },
    });

    ui.openSettings();
    await nextTick();

    const recordButton = wrapper.find("[data-command-id='format.bold'] .settings-panel__capture");
    await recordButton.trigger("click");
    expect(ui.settingsShortcutRecording).toBe(true);

    await recordButton.trigger("keydown", { key: "Escape" });
    await nextTick();

    expect(ui.settingsShortcutRecording).toBe(false);
    expect(ui.settingsOpen).toBe(true);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it("closes the command palette on global Escape", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();
    ui.openCommandPalette();

    mount(AppShell, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await nextTick();
    expect(ui.commandPaletteOpen).toBe(false);
  });

});
