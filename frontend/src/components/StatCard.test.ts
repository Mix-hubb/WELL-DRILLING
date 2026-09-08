import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StatCard from "./StatCard.vue";

const stubs = {
  "v-icon": { template: `<span class="ic" :icon="$attrs.icon" :color="$attrs.color" />` },
  "v-card": { template: `<div class="stat-card-stub"><slot /></div>` },
};

function mountWith(props: { label: string; value: string; icon: string; color?: string; sub?: string }) {
  return mount(StatCard, {
    props,
    global: { stubs },
  });
}

describe("StatCard", () => {
  it("renders label, value and sub text", () => {
    const wrapper = mountWith({ label: "งานทั้งหมด", value: "12", icon: "mdi-database", sub: "+2 สัปดาห์นี้" });
    expect(wrapper.text()).toContain("งานทั้งหมด");
    expect(wrapper.text()).toContain("12");
    expect(wrapper.text()).toContain("+2 สัปดาห์นี้");
  });

  it("defaults to the primary theme color", () => {
    const wrapper = mountWith({ label: "x", value: "1", icon: "mdi-star" });
    expect(wrapper.find(".stat-tile").attributes("style") || wrapper.find(".stat-tile").element.getAttribute("style"))
      .toContain("--v-theme-primary");
    expect(wrapper.find(".ic").attributes("color")).toBe("primary");
  });

  it("applies a custom color", () => {
    const wrapper = mountWith({ label: "x", value: "1", icon: "mdi-star", color: "success" });
    expect(wrapper.find(".stat-tile").element.getAttribute("style")).toContain("--v-theme-success");
  });

  it("renders no sub line when sub is omitted", () => {
    const wrapper = mountWith({ label: "x", value: "1", icon: "mdi-star" });
    expect(wrapper.text()).not.toContain("mt-1");
  });
});