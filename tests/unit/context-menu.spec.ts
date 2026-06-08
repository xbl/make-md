import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import ContextMenu from "@/components/ContextMenu.vue";
import { createContextMenuController, type ContextMenuItem } from "@/lib/context-menu";

describe("ContextMenu", () => {
  const items: ContextMenuItem[] = [
    { type: "action", id: "copy", label: "Copy", shortcut: "Cmd+C" },
    { type: "action", id: "paste", label: "Paste", disabled: true },
    { type: "separator", id: "sep-1" },
    { type: "action", id: "rename", label: "Rename" },
  ];

  it("renders action items, shortcuts, separators, and disabled state", () => {
    const wrapper = mount(ContextMenu, {
      props: {
        open: true,
        x: 120,
        y: 48,
        items,
      },
    });

    const menu = wrapper.get(".context-menu");
    const buttons = wrapper.findAll("button.context-menu__item");

    expect(menu.attributes("style")).toContain("left: 120px");
    expect(menu.attributes("style")).toContain("top: 48px");
    expect(buttons).toHaveLength(3);
    expect(buttons[0].text()).toContain("Copy");
    expect(buttons[0].text()).toContain("Cmd+C");
    expect(buttons[1].attributes("disabled")).toBeDefined();
    expect(wrapper.findAll(".context-menu__separator")).toHaveLength(1);
  });

  it("provides a lightweight reusable controller for menu state", () => {
    const controller = createContextMenuController();

    expect(controller.state.open).toBe(false);
    expect(controller.state.x).toBe(0);
    expect(controller.state.y).toBe(0);

    controller.openAt(32, 64);
    expect(controller.state.open).toBe(true);
    expect(controller.state.x).toBe(32);
    expect(controller.state.y).toBe(64);

    controller.close("click-away");
    expect(controller.state.open).toBe(false);
  });

  it("emits close on Escape", async () => {
    const wrapper = mount(ContextMenu, {
      attachTo: document.body,
      props: {
        open: true,
        x: 16,
        y: 24,
        items,
      },
    });

    await nextTick();
    expect(document.activeElement).toBe(wrapper.get(".context-menu").element);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    await nextTick();

    expect(wrapper.emitted("close")).toEqual([["escape"]]);
  });

  it("emits close on click-away", async () => {
    const wrapper = mount(ContextMenu, {
      attachTo: document.body,
      props: {
        open: true,
        x: 20,
        y: 28,
        items,
      },
    });

    document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("close")).toEqual([["click-away"]]);
  });
});
