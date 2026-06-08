import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";
import StatusBar from "@/components/StatusBar.vue";
import { useUiStore } from "@/stores/ui";

describe("StatusBar", () => {
  it("shows the current editor mode", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const ui = useUiStore();

    const wrapper = mount(StatusBar, {
      global: {
        plugins: [pinia],
      },
    });

    expect(wrapper.text()).toContain("Rich Text");

    ui.toggleSourceMode();
    await nextTick();
    expect(wrapper.text()).toContain("Source");
  });
});
