import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import AppShell from "../../src/layout/AppShell.vue";

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
});
