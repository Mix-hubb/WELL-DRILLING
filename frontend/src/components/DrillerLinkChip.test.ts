import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import DrillerLinkChip from "./DrillerLinkChip.vue";
import { useAuthStore } from "@/stores/auth";

const stubs = {
  "v-icon": { template: `<span />` },
  "v-btn": { template: `<button class="btn"><slot /></button>` },
  "v-chip": { template: `<span class="chip"><slot /></span>` },
};

function mountWith(props: { token: string | null; path: string; locked?: boolean }) {
  return mount(DrillerLinkChip, { props, global: { stubs } });
}

function setRole(role: "ADMIN" | "DRILLER" | null) {
  const auth = useAuthStore();
  auth.user = role ? ({ user_id: 1, email: "a@b.co", full_name: "x", role } as any) : null;
}

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("DrillerLinkChip", () => {
  it("admin, unlocked: shows the regenerate button", () => {
    setRole("ADMIN");
    const wrapper = mountWith({ token: "tok-1", path: "/d/", locked: false });
    expect(wrapper.text()).toContain("สร้างใหม่");
    expect(wrapper.find(".chip").exists()).toBe(false);
  });

  it("driller, unlocked: hides the regenerate button and shows no lock chip either (no permission, not yet completed)", () => {
    setRole("DRILLER");
    const wrapper = mountWith({ token: "tok-1", path: "/d/", locked: false });
    expect(wrapper.text()).not.toContain("สร้างใหม่");
    expect(wrapper.text()).not.toContain("สร้างลิงก์");
    expect(wrapper.find(".chip").exists()).toBe(false);
  });

  it("admin, locked (already recorded): shows the locked chip, not the regenerate button", () => {
    setRole("ADMIN");
    const wrapper = mountWith({ token: "tok-1", path: "/d/", locked: true });
    expect(wrapper.find(".chip").exists()).toBe(true);
    expect(wrapper.text()).toContain("บันทึกข้อมูลแล้ว");
  });

  it("driller, locked: shows the locked chip too (informational, no action either way)", () => {
    setRole("DRILLER");
    const wrapper = mountWith({ token: "tok-1", path: "/d/", locked: true });
    expect(wrapper.find(".chip").exists()).toBe(true);
  });

  it("shows the copy button for anyone when a token exists, regardless of role", () => {
    setRole("DRILLER");
    const wrapper = mountWith({ token: "tok-1", path: "/d/", locked: false });
    expect(wrapper.text()).toContain("copy");
  });
});
