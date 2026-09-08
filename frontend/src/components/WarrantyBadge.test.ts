import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import WarrantyBadge from "./WarrantyBadge.vue";

const ChipStub = {
  template: `<span class="chip" :color="$attrs.color" :prepend-icon="$attrs.prependIcon"><slot /></span>`,
};

function mountWith(props: { alertTier: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED"; remainingDays: number; expiryDate: string }) {
  return mount(WarrantyBadge, {
    props,
    global: { stubs: { "v-chip": ChipStub } },
  });
}

describe("WarrantyBadge", () => {
  it("shows the active tier with a success color", () => {
    const wrapper = mountWith({ alertTier: "ACTIVE", remainingDays: 30, expiryDate: "2028-01-01" });
    expect(wrapper.text()).toContain("ในประกัน · เหลือ 30 วัน");
    expect(wrapper.find(".chip").attributes("color")).toBe("success");
    expect(wrapper.find(".chip").attributes("prepend-icon")).toBe("mdi-shield-check-outline");
  });

  it("shows the expiring-soon tier with a warning color", () => {
    const wrapper = mountWith({ alertTier: "EXPIRING_SOON", remainingDays: 14, expiryDate: "2026-09-22" });
    expect(wrapper.text()).toContain("ใกล้หมดประกัน · เหลือ 14 วัน");
    expect(wrapper.find(".chip").attributes("color")).toBe("warning");
  });

  it("shows the expired tier with the absolute day count", () => {
    const wrapper = mountWith({ alertTier: "EXPIRED", remainingDays: -5, expiryDate: "2025-09-01" });
    expect(wrapper.text()).toContain("หมดประกันแล้ว · 5 วัน");
    expect(wrapper.find(".chip").attributes("color")).toBe("error");
    expect(wrapper.find(".chip").attributes("prepend-icon")).toBe("mdi-shield-off-outline");
  });
});