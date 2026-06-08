import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import AiEditToolbar from "@/components/AiEditToolbar.vue";

describe("AiEditToolbar", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders built-in rewrite presets", () => {
    const wrapper = mount(AiEditToolbar, {
      props: {
        left: 120,
        top: 24,
      },
      global: {
        plugins: [createPinia()],
      },
    });

    expect(wrapper.text()).toContain("Polish");
    expect(wrapper.text()).toContain("Condense");
    expect(wrapper.text()).toContain("Custom...");
    expect(wrapper.attributes("style")).toContain("left: 120px");
    expect(wrapper.attributes("style")).toContain("top: 24px");
  });
});
