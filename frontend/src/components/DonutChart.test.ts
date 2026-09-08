import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DonutChart from "./DonutChart.vue";

const segments = [
  { label: "เสร็จ", value: 60, color: "#4caf50" },
  { label: "รอ", value: 40, color: "#ff9800" },
];

function mountWith(seg: typeof segments, size = 160) {
  return mount(DonutChart, { props: { segments: seg, size } });
}

const circle = (wrapper: ReturnType<typeof mount>, i: number) => wrapper.findAll("circle")[i];

describe("DonutChart", () => {
  it("renders the totals text", () => {
    const wrapper = mountWith(segments);
    expect(wrapper.text()).toContain("100");
    expect(wrapper.text()).toContain("รวมทั้งหมด");
  });

  it("renders one arc per segment with proportional dashes", () => {
    const wrapper = mountWith(segments);
    const circles = wrapper.findAll("circle");
    expect(circles).toHaveLength(2);

    const radius = 160 / 2 - 14;
    const circumference = 2 * Math.PI * radius;

    const [first, second] = circles.map((c) => {
      const [dash, gap] = c.attributes("stroke-dasharray")!.split(" ").map(Number);
      return { dash, gap, color: c.attributes("stroke") };
    });

    expect(first.dash).toBeCloseTo((60 / 100) * circumference, 5);
    expect(first.gap).toBeCloseTo(circumference - first.dash, 5);
    expect(first.color).toBe("#4caf50");

    expect(second.dash).toBeCloseTo((40 / 100) * circumference, 5);
    expect(second.color).toBe("#ff9800");
  });

  it("lists every segment label and value", () => {
    const wrapper = mountWith(segments);
    expect(wrapper.text()).toContain("เสร็จ");
    expect(wrapper.text()).toContain("รอ");
    expect(wrapper.text()).toContain("60");
    expect(wrapper.text()).toContain("40");
  });

  it("avoids NaN dashes when the total is zero", () => {
    const wrapper = mountWith([{ label: "ว่าง", value: 0, color: "#ccc" }]);
    const [dash, gap] = circle(wrapper, 0).attributes("stroke-dasharray")!.split(" ").map(Number);
    expect(Number.isNaN(dash)).toBe(false);
    expect(dash).toBe(0);
    expect(gap).toBeGreaterThan(0);
  });

  it("honours a custom size", () => {
    const wrapper = mountWith(segments, 200);
    expect(wrapper.find("svg").attributes("width")).toBe("200");
    const radius = 200 / 2 - 14;
    const circumference = 2 * Math.PI * radius;
    const [dash, gap] = circle(wrapper, 0).attributes("stroke-dasharray")!.split(" ").map(Number);
    expect(dash).toBeCloseTo((60 / 100) * circumference, 5);
    expect(gap).toBeGreaterThan(0);
  });
});