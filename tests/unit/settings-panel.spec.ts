import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { vi } from "vitest";
import SettingsPanel from "@/components/SettingsPanel.vue";
import { useShortcutsStore } from "@/stores/shortcuts";
import { useUiStore } from "@/stores/ui";

describe("SettingsPanel", () => {
  function mountPanel() {
    const pinia = createPinia();
    setActivePinia(pinia);
    return {
      pinia,
      ui: useUiStore(),
      shortcuts: useShortcutsStore(),
    };
  }

  beforeEach(() => {
    globalThis.localStorage?.clear();
  });

  it("renders when settings are open and records a shortcut override", async () => {
    const { pinia, ui, shortcuts } = mountPanel();
    ui.openSettings();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const wrapper = mount(SettingsPanel, {
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.find("[data-testid='settings-panel']").exists()).toBe(true);
    expect(wrapper.text()).toContain("Preferences");
    expect(wrapper.text()).toContain("Bold");

    const recordButton = wrapper.find("[data-command-id='format.bold'] .settings-panel__capture");
    expect(recordButton.exists()).toBe(true);

    await recordButton.trigger("click");
    await recordButton.trigger("keydown", { key: "K", metaKey: true });

    expect(shortcuts.effectiveChord("format.bold")).toBe("Mod-k");
    expect(confirmSpy).toHaveBeenCalled();
    expect(shortcuts.effectiveChord("format.link")).toBeNull();
  });

  it("supports per-command reset and reset all", async () => {
    const { pinia, ui, shortcuts } = mountPanel();
    shortcuts.applyOverride("format.bold", "Mod-Shift-b");
    shortcuts.applyOverride("format.italic", "Mod-Shift-i");
    ui.openSettings();

    const wrapper = mount(SettingsPanel, {
      global: {
        plugins: [pinia],
      },
    });

    const boldRow = wrapper.find("[data-command-id='format.bold']");
    await boldRow.find("button[title='Reset shortcut']").trigger("click");
    expect(shortcuts.effectiveChord("format.bold")).toBe("Mod-b");

    await wrapper.find("button[title='Reset all shortcuts']").trigger("click");
    expect(shortcuts.effectiveChord("format.italic")).toBe("Mod-i");
  });
});
