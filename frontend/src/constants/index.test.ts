import { describe, it, expect } from "vitest";
import {
  money,
  JOB_STATUS,
  REQUEST_STATUS,
  REPAIR_STATUS,
  QUOTATION_STATUS,
  JOB_STATUS_HEX,
  PUMP_TYPE,
  HARDNESS,
} from "./index";

describe("money", () => {
  it("formats 0 as 0", () => {
    expect(money(0)).toBe("0");
  });

  it("formats null and undefined as 0", () => {
    expect(money(null)).toBe("0");
    expect(money(undefined)).toBe("0");
  });

  it("groups large numbers in the thai style", () => {
    expect(money(1234567)).toBe("1,234,567");
  });

  it("does not render decimal places for whole numbers", () => {
    expect(money(120)).toBe("120");
  });
});

describe("status lookup maps", () => {
  it("covers every job status", () => {
    for (const s of ["QUEUED", "DRILLING", "SUCCESS", "FAILED", "CLOSED"]) {
      expect(JOB_STATUS[s]).toBeDefined();
      expect(JOB_STATUS[s].label).toBeTruthy();
      expect(JOB_STATUS[s].color).toBeTruthy();
    }
  });

  it("covers every request status", () => {
    for (const s of ["NEW", "QUOTED", "ACCEPTED", "REJECTED", "CANCELLED"]) {
      expect(REQUEST_STATUS[s]).toBeDefined();
    }
  });

  it("covers every repair status", () => {
    for (const s of ["NEW", "QUOTED", "ACCEPTED", "REJECTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"]) {
      expect(REPAIR_STATUS[s]).toBeDefined();
    }
  });

  it("covers every quotation status", () => {
    for (const s of ["PENDING", "ACCEPTED", "REJECTED"]) {
      expect(QUOTATION_STATUS[s]).toBeDefined();
    }
  });
});

describe("JOB_STATUS_HEX", () => {
  it("provides a hex color for each job status", () => {
    for (const s of Object.keys(JOB_STATUS)) {
      expect(JOB_STATUS_HEX[s as keyof typeof JOB_STATUS_HEX]).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});

describe("PUMP_TYPE / HARDNESS", () => {
  it("maps pump types to thai labels", () => {
    expect(PUMP_TYPE.AC_SUBMERSIBLE).toContain("AC");
    expect(PUMP_TYPE.DC_SOLAR_SUBMERSIBLE).toContain("โซลาร์");
    expect(PUMP_TYPE.OTHER).toBe("อื่นๆ");
  });

  it("maps hardness levels to thai labels", () => {
    expect(HARDNESS.VERY_SOFT).toBe("อ่อนมาก");
    expect(HARDNESS.VERY_HARD).toBe("แข็งมาก");
  });
});