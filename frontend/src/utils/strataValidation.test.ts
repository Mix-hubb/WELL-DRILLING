import { describe, it, expect } from "vitest";
import { validateStrataList } from "./strataValidation";

describe("validateStrataList", () => {
  it("returns null when ranges are valid and within total depth", () => {
    const result = validateStrataList(
      [{ depth_from_m: 0, depth_to_m: 10 }, { depth_from_m: 10, depth_to_m: 20 }],
      20
    );
    expect(result).toBeNull();
  });

  it("rejects a range where depth_to_m exceeds the well's total depth", () => {
    const result = validateStrataList([{ depth_from_m: 190, depth_to_m: 210 }], 200);
    expect(result).toContain("เกินความลึกรวมของบ่อ");
  });

  it("rejects overlapping ranges", () => {
    const result = validateStrataList(
      [{ depth_from_m: 0, depth_to_m: 20 }, { depth_from_m: 10, depth_to_m: 30 }],
      200
    );
    expect(result).toContain("ทับซ้อน");
  });

  it("allows back-to-back ranges that touch at the boundary", () => {
    const result = validateStrataList(
      [{ depth_from_m: 0, depth_to_m: 20 }, { depth_from_m: 20, depth_to_m: 40 }],
      200
    );
    expect(result).toBeNull();
  });
});
