import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { describe, expect, it } from "vitest";
import SourceEditor from "@/components/SourceEditor.vue";

describe("SourceEditor", () => {
  function mountEditor(modelValue: string) {
    const pinia = createPinia();
    setActivePinia(pinia);
    return mount(SourceEditor, {
      props: { modelValue },
      global: {
        plugins: [pinia],
      },
    });
  }

  it("renders line numbers and emits updated content", async () => {
    const wrapper = mountEditor("# Hello\n\nWorld");

    expect(wrapper.find("[data-testid='source-gutter']").text()).toContain("1");
    expect(wrapper.find("[data-testid='source-gutter']").text()).toContain("3");

    const input = wrapper.find("[data-testid='source-input']");
    await input.setValue("# Updated");

    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["# Updated"]);
  });

  it("indents and outdents the current line with Tab and Shift+Tab", async () => {
    const wrapper = mountEditor("alpha");

    const input = wrapper.find("[data-testid='source-input']");
    const el = input.element as HTMLTextAreaElement;
    el.selectionStart = 0;
    el.selectionEnd = 0;

    await input.trigger("keydown", { key: "Tab" });
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["  alpha"]);

    await wrapper.setProps({ modelValue: "  alpha" });
    el.selectionStart = 0;
    el.selectionEnd = 0;
    await input.trigger("keydown", { key: "Tab", shiftKey: true });
    expect(wrapper.emitted("update:modelValue")?.[1]).toEqual(["alpha"]);
  });

  it("indents all selected lines with Tab", async () => {
    const wrapper = mountEditor("alpha\nbeta");

    const input = wrapper.find("[data-testid='source-input']");
    const el = input.element as HTMLTextAreaElement;
    el.selectionStart = 0;
    el.selectionEnd = "alpha\nbeta".length;

    await input.trigger("keydown", { key: "Tab" });
    expect(wrapper.emitted("update:modelValue")?.[0]).toEqual(["  alpha\n  beta"]);
  });
});
