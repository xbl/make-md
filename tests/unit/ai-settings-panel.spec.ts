import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import AiSettingsPanel from "@/components/AiSettingsPanel.vue";
import { useAiStore } from "@/stores/ai";

describe("AiSettingsPanel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("renders provider controls when opened", () => {
    const ai = useAiStore();
    ai.openSettings();

    const wrapper = mount(AiSettingsPanel, {
      global: {
        stubs: { Teleport: true },
      },
    });

    expect(wrapper.text()).toContain("AI Settings");
    expect(wrapper.text()).toContain("OpenAI");
    expect(wrapper.text()).toContain("DeepSeek");
  });
});
