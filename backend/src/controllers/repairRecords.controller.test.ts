import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock("../config/db", () => ({ pool: { query: mocks.poolQuery } }));
vi.mock("../services/sse", () => ({ broadcast: mocks.broadcast }));

import * as repairRecords from "./repairRecords.controller";

function createRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn();
  return res;
}

function createReq(overrides: Record<string, any> = {}): Request {
  return {
    body: {},
    params: {},
    query: {},
    user: { orgId: "org-1" },
    ...overrides,
  } as unknown as Request;
}

const recordRow = {
  record_id: "rec-1",
  repair_id: "r-1",
  final_price: 1500,
  work_details: "เปลี่ยนปั๊มน้ำ",
  parts: null,
  pump: null,
  is_warranty_claim: false,
  completed_at: "2025-06-01",
  created_at: "2025-06-01",
  customer_id: 2,
  customer_name: "นายสมชาย",
  customer_phone: "0812345678",
};

const recordRowMapped = {
  record_id: "rec-1",
  repair_id: "r-1",
  final_price: 1500,
  work_details: "เปลี่ยนปั๊มน้ำ",
  parts: [],
  pump: null,
  is_warranty_claim: false,
  completed_at: "2025-06-01",
  created_at: "2025-06-01",
};

beforeEach(() => {
  mocks.poolQuery.mockReset();
  mocks.broadcast.mockReset();
});

describe("list", () => {
  it("returns repair record rows", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [recordRow] });
    const res = createRes();
    await repairRecords.list(createReq(), res);
    expect(res.json).toHaveBeenCalledWith([recordRowMapped]);
  });
});

describe("getOne", () => {
  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await repairRecords.getOne(createReq({ params: { id: "999" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the record", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [recordRow] });
    const res = createRes();
    await repairRecords.getOne(createReq({ params: { id: "rec-1" } }), res);
    expect(res.json).toHaveBeenCalledWith(recordRowMapped);
  });
});

describe("remove", () => {
  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await repairRecords.remove(createReq({ params: { id: "999" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes and returns 204", async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ record_id: "rec-1" }] })
      .mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await repairRecords.remove(createReq({ params: { id: "rec-1" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "DELETE FROM repair_records WHERE record_id = $1",
      ["rec-1"]
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});
