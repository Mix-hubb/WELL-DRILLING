import { describe, it, expect } from "vitest";
import { buildWellInfoFlex, buildWarrantyFlex } from "./webhooks.routes";

describe("buildWellInfoFlex", () => {
  it("generates carousel with footer containing PDF download button", () => {
    const wells = [
      {
        well_id: 42,
        well_name: "บ่อไร่องุ่น",
        total_depth_m: 80,
        water_quantity_m3hr: 6.2,
        yield_lpm: 103,
        completion_date: "2026-02-15",
      },
    ];

    const flex = buildWellInfoFlex("สมเกียรติ", wells, "https://api.example.com");

    expect(flex.type).toBe("carousel");
    expect(flex.contents).toHaveLength(1);

    const bubble = flex.contents[0];
    expect(bubble.type).toBe("bubble");
    expect(bubble.header?.contents[0].text).toBe("บ่อไร่องุ่น");

    // Check footer exists with uri action for PDF download
    expect(bubble.footer).toBeDefined();
    expect(bubble.footer?.type).toBe("box");
    const button = bubble.footer?.contents[0];
    expect(button.type).toBe("button");
    expect(button.action.type).toBe("uri");
    expect(button.action.label).toBe("ดาวน์โหลดรายงาน PDF");
    expect(button.action.uri).toBe("https://api.example.com/api/public/wells/42/report.pdf");
  });

  it("handles empty baseUrl with fallback", () => {
    const wells = [{ well_id: 99, well_name: "บ่อสำรอง" }];
    const flex = buildWellInfoFlex("วิชัย", wells);
    const bubble = flex.contents[0];
    expect(bubble.footer?.contents[0].action.uri).toContain("/api/public/wells/99/report.pdf");
  });
});

describe("buildWarrantyFlex", () => {
  it("generates warranty flex card with PDF download button", () => {
    const wells = [
      {
        well_id: 15,
        well_name: "บ่อบ้านพัก",
        warranty_status: "ACTIVE",
        days_left: 120,
        warranty_expire_date: "2026-12-31",
      },
    ];

    const flex = buildWarrantyFlex(wells, "https://api.example.com");
    expect(flex.type).toBe("carousel");
    const bubble = flex.contents[0];
    expect(bubble.footer).toBeDefined();
    const button = bubble.footer?.contents[0];
    expect(button.action.label).toBe("ดาวน์โหลดรายงาน PDF");
    expect(button.action.uri).toBe("https://api.example.com/api/public/wells/15/report.pdf");
  });
});
