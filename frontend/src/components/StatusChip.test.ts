import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { JOB_STATUS, REQUEST_STATUS, REPAIR_STATUS } from "@/constants";
import StatusChip from "./StatusChip.vue";

const ChipStub = {
  template: `<span class="chip" :color="$attrs.color" :size="$attrs.size"><slot /></span>`,
};

function mountWith(status: string) {
  return mount(StatusChip, {
    props: { status },
    global: { stubs: { "v-chip": ChipStub } },
  });
}

describe("StatusChip", () => {
  it("renders the known label for a job status", () => {
    const wrapper = mountWith("SUCCESS");
    expect(wrapper.text()).toContain(JOB_STATUS.SUCCESS.label);
    expect(wrapper.find(".chip").attributes("color")).toBe(JOB_STATUS.SUCCESS.color);
  });

  it("renders the known label for a request status", () => {
    const wrapper = mountWith("CANCELLED");
    expect(wrapper.text()).toContain(REQUEST_STATUS.CANCELLED.label);
  });

  it("renders the known label for a repair status", () => {
    const wrapper = mountWith("COMPLETED");
    expect(wrapper.text()).toContain(REPAIR_STATUS.COMPLETED.label);
  });

  it("falls back to the raw status with grey color for unknown values", () => {
    const wrapper = mountWith("UNKNOWN_STATUS");
    expect(wrapper.text()).toContain("UNKNOWN_STATUS");
    expect(wrapper.find(".chip").attributes("color")).toBe("grey");
  });
});