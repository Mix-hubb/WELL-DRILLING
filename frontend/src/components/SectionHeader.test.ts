import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SectionHeader from "./SectionHeader.vue";

const stubs = {
  "v-icon": { template: `<span class="ic" :icon="$attrs.icon" />` },
  "v-btn": { template: `<button class="add-btn"><slot /></button>` },
};

function mountWith(title: string, icon: string) {
  return mount(SectionHeader, {
    props: { title, icon },
    global: { stubs },
  });
}

describe("SectionHeader", () => {
  it("renders the title and icon", () => {
    const wrapper = mountWith("รายการงาน", "mdi-briefcase");
    expect(wrapper.text()).toContain("รายการงาน");
    expect(wrapper.find(".ic").attributes("icon")).toBe("mdi-briefcase");
  });

  it("emits add when the button is pressed", async () => {
    const wrapper = mountWith("รายการงาน", "mdi-briefcase");
    await wrapper.find(".add-btn").trigger("click");
    expect(wrapper.emitted("add")).toHaveLength(1);
  });
});