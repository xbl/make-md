import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { vi } from "vitest";
import SettingsPanel from "@/components/SettingsPanel.vue";
import { usePreferencesStore } from "@/stores/preferences";
import { useShortcutsStore } from "@/stores/shortcuts";
import { useUiStore } from "@/stores/ui";

describe("SettingsPanel", () => {
  function mountPanel() {
    const pinia = createPinia();
    setActivePinia(pinia);
    return {
      pinia,
      preferences: usePreferencesStore(),
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

    await wrapper.find("button[title='Reset All']").trigger("click");
    expect(shortcuts.effectiveChord("format.italic")).toBe("Mod-i");
  });

  it("groups enabled commands by category and excludes disabled commands from rebinding", async () => {
    const { pinia, ui } = mountPanel();
    ui.openSettings();

    const wrapper = mount(SettingsPanel, {
      global: {
        plugins: [pinia],
      },
    });

    const headings = wrapper.findAll(".settings-panel__category-title").map((node) => node.text());
    expect(headings).toContain("File");
    expect(headings).toContain("Format");
    expect(wrapper.find("[data-command-id='format.underline']").exists()).toBe(false);
    expect(wrapper.text()).toContain("Unavailable commands");
    expect(wrapper.text()).toContain("Underline");
  });

  it("shows an inline hint for invalid chords and clears recording when preferences close", async () => {
    const { pinia, ui, shortcuts } = mountPanel();
    ui.openSettings();

    const wrapper = mount(SettingsPanel, {
      global: {
        plugins: [pinia],
      },
    });

    const recordButton = wrapper.find("[data-command-id='format.bold'] .settings-panel__capture");
    await recordButton.trigger("click");
    expect(ui.settingsShortcutRecording).toBe(true);

    await recordButton.trigger("keydown", { key: "b" });
    await nextTick();

    expect(wrapper.text()).toContain("Use a shortcut with modifier keys");
    expect(shortcuts.effectiveChord("format.bold")).toBe("Mod-b");

    ui.closeSettings();
    await nextTick();

    expect(ui.settingsShortcutRecording).toBe(false);
    expect(wrapper.find("[data-testid='settings-panel']").exists()).toBe(false);
  });

  it("rejects system reserved shortcuts and keeps the existing binding", async () => {
    const { pinia, ui, shortcuts } = mountPanel();
    ui.openSettings();

    const wrapper = mount(SettingsPanel, {
      global: {
        plugins: [pinia],
      },
    });

    const recordButton = wrapper.find("[data-command-id='format.bold'] .settings-panel__capture");
    await recordButton.trigger("click");
    await recordButton.trigger("keydown", { key: "c", metaKey: true });
    await nextTick();

    expect(shortcuts.effectiveChord("format.bold")).toBe("Mod-b");
    expect(wrapper.text()).toContain("This shortcut is reserved by the system and cannot be reassigned");
    expect(ui.settingsShortcutRecording).toBe(true);
  });

  it("shows a language selector and updates labels when the locale changes", async () => {
    const { pinia, preferences, ui } = mountPanel();
    await preferences.initialize();
    ui.openSettings();

    const wrapper = mount(SettingsPanel, {
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain("Preferences");
    expect(wrapper.get("[data-testid='language-select']").exists()).toBe(true);

    await preferences.setLanguagePreference("zh-CN");
    await nextTick();

    expect(wrapper.text()).toContain("偏好设置");
    expect(wrapper.text()).toContain("跟随系统");
  });
});
