import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { PassThrough } from "stream";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  streamWellReportPdf: vi.fn(),
}));

vi.mock("../config/db", () => ({
  pool: { query: mocks.poolQuery },
}));
vi.mock("../utils/pdfReport", () => ({
  streamWellReportPdf: mocks.streamWellReportPdf,
}));

import * as wellsCtrl from "./wells.controller";

function createRes() {
  const res: any = { statusCode: 200, headers: {} };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockImplementation((k, v) => {
    res.headers[k] = v;
    return res;
  });
  return res as Response & { statusCode: number; json: any; status: any; setHeader: any; headers: any };
}

describe("wells.controller exportReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 404 if well is not found", async () => {
    const req = {
      params: { id: "99" },
      user: { userId: "u-1", orgId: "org-1" },
    } as unknown as Request;
    const res = createRes();

    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

    await wellsCtrl.exportReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should stream PDF report when well exists", async () => {
    const req = {
      params: { id: "1" },
      user: { userId: "u-1", orgId: "org-1" },
    } as unknown as Request;
    const res = createRes();

    mocks.poolQuery.mockResolvedValueOnce({
      rows: [
        {
          well_id: 1,
          well_name: "บ่อหลักสวนมะนาว",
          address: "123 ต.ในเมือง",
          customer_name: "สมชาย ใจดี",
          total_depth_m: 60,
          water_quantity_m3hr: 5.5,
        },
      ],
    });
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

    await wellsCtrl.exportReport(req, res);

    expect(mocks.streamWellReportPdf).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ well_id: 1, well_name: "บ่อหลักสวนมะนาว" }),
      expect.objectContaining({ customer_name: "สมชาย ใจดี" })
    );
  });

  it("should stream PDF report for public request without user auth", async () => {
    const req = {
      params: { id: "10" },
    } as unknown as Request;
    const res = createRes();

    mocks.poolQuery.mockResolvedValueOnce({
      rows: [
        {
          well_id: 10,
          well_name: "บ่อสาธารณะ",
          customer_name: "สมหญิง",
        },
      ],
    });
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

    await wellsCtrl.exportReport(req, res);

    expect(mocks.streamWellReportPdf).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ well_id: 10, well_name: "บ่อสาธารณะ" }),
      expect.objectContaining({ customer_name: "สมหญิง" })
    );
  });
});

describe("streamWellReportPdf (actual implementation)", () => {
  it("should build valid PDF output stream without crashing", async () => {
    const actualPdfReport = await vi.importActual<any>("../utils/pdfReport");
    const mockRes = new PassThrough() as any;
    mockRes.setHeader = vi.fn();

    const fullWell: any = {
      well_id: 101,
      well_name: "บ่อทดสอบ",
      total_depth_m: 45,
      water_quantity_m3hr: 3.2,
      requested_depth_m: 50,
      drilling_method: "ROTARY",
      strata: [
        { depth_from_m: 0, depth_to_m: 15, lithology_type: "CLAY", description: "ดินเหนียวปนทราย" },
      ],
      pipes: [
        { depth_from_m: 0, depth_to_m: 45, material: "PVC", pipe_type: "CASING", size_mm: 150, quantity: 11 },
      ],
      pumps: [
        { pump_type: "AC_SUBMERSIBLE", brand: "FRANKLIN", pump_model: "10FPS05", horsepower: "1.5", installation_depth_m: 35 },
      ],
      control_boxes: [
        { brand: "SCHNEIDER", model: "CB-01", capacity: "2HP", protection_type: "OVERLOAD_RELAY" },
      ],
      notes: "น้ำใส ไหลแรงสม่ำเสมอ",
    };

    const job = {
      job_title: "ขุดเจาะบ่อทดสอบ",
      site_address: "จ.ขอนแก่น",
      customer_name: "ทดสอบ ผู้รับบริการ",
      driller_name: "ช่างเด่น",
      scheduled_date: "2026-03-01",
    };

    expect(() => {
      actualPdfReport.streamWellReportPdf(mockRes, fullWell, job);
    }).not.toThrow();

    expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
  });
});
