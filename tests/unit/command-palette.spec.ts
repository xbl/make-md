import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import CommandPalette from "@/components/CommandPalette.vue";
import { usePreferencesStore } from "@/stores/preferences";
import { useUiStore } from "@/stores/ui";

describe("CommandPalette", () => {
  function mountPalette() {
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();
    const preferences = usePreferencesStore();
    ui.openCommandPalette();

    const wrapper = mount(CommandPalette, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    return { wrapper, ui, preferences };
  }

  it("closes on Escape from the palette container", async () => {
    const { wrapper, ui } = mountPalette();
    await wrapper.find(".command-palette").trigger("keydown", { key: "Escape" });
    expect(ui.commandPaletteOpen).toBe(false);
  });

  it("shows editor commands and disables them when no editor view is available", () => {
    const { wrapper } = mountPalette();
    const boldButton = wrapper
      .findAll("button.command-palette__item")
      .find((button) => button.text().includes("Bold"));

    expect(boldButton).toBeTruthy();
    expect(boldButton!.attributes("disabled")).toBeDefined();
  });

  it("shows AI rewrite document action", () => {
    const { wrapper } = mountPalette();
    expect(wrapper.text()).toContain("AI Rewrite Document");
  });

  it("localizes palette copy and command labels", async () => {
    const { wrapper, preferences } = mountPalette();
    await preferences.setLanguagePreference("zh-CN");
    await wrapper.vm.$nextTick();

    expect(wrapper.find(".command-palette__panel").attributes("aria-label")).toBe("命令面板");
    expect(wrapper.find(".command-palette__input").attributes("placeholder")).toBe("输入命令…");
    expect(wrapper.text()).toContain("AI 改写全文");
  });
});
