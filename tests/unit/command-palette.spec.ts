import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import CommandPalette from "@/components/CommandPalette.vue";
import { useUiStore } from "@/stores/ui";

describe("CommandPalette", () => {
  function mountPalette() {
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();
    ui.openCommandPalette();

    const wrapper = mount(CommandPalette, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
      },
    });

    return { wrapper, ui };
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
});
