import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  sendFlexToCustomer: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock("../config/db", () => ({ pool: { query: mocks.poolQuery } }));
vi.mock("../services/line", () => ({ sendFlexToCustomer: mocks.sendFlexToCustomer }));
vi.mock("../services/sse", () => ({ broadcast: mocks.broadcast }));

import * as quotations from "./quotations.controller";

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

const quotationRow = {
  quotation_id: 1,
  kind: "DRILLING",
  drilling_request_id: 10,
  repair_request_id: null,
  requested_depth_m: 30,
  requested_diameter_m: null,
  price: 25000,
  notes: "ทดสอบ",
  status: "PENDING",
  created_at: "2025-05-20",
  updated_at: "2025-05-20",
};

beforeEach(() => {
  mocks.poolQuery.mockReset();
  mocks.sendFlexToCustomer.mockReset();
  mocks.sendFlexToCustomer.mockResolvedValue(true);
  mocks.broadcast.mockReset();

  mocks.poolQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("INSERT INTO quotations")) return { rows: [{ quotation_id: 1 }] };
    if (sql.includes("UPDATE drilling_requests SET status")) return { rows: [] };
    if (sql.includes("UPDATE repair_requests SET status")) return { rows: [] };
    if (sql.includes("SELECT * FROM quotations")) return { rows: [quotationRow] };
    if (sql.includes("SELECT r.request_id FROM drilling_requests")) return { rows: [{ request_id: 10 }] };
    if (sql.includes("SELECT r.repair_id FROM repair_requests")) return { rows: [{ repair_id: "r-1" }] };
    if (sql.includes("SELECT c.customer_id FROM")) return { rows: [{ customer_id: 2 }] };
    if (sql.includes("quotation_id = $1")) return { rows: [quotationRow] };
    return { rows: [] };
  });
});

describe("create", () => {
  it("returns 400 when kind is invalid", async () => {
    const res = createRes();
    await quotations.create(createReq({ body: { kind: "INVALID" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when drilling_request_id is missing for DRILLING kind", async () => {
    const res = createRes();
    await quotations.create(createReq({ body: { kind: "DRILLING", price: 1000 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when repair_request_id is missing for REPAIR kind", async () => {
    const res = createRes();
    await quotations.create(createReq({ body: { kind: "REPAIR", price: 1000 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when price is missing or zero", async () => {
    const res = createRes();
    await quotations.create(
      createReq({ body: { kind: "DRILLING", drilling_request_id: 10, price: 0 } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when drilling request ownership check fails", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT r.request_id FROM drilling_requests")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await quotations.create(
      createReq({ body: { kind: "DRILLING", drilling_request_id: 10, price: 5000 } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 404 when repair request ownership check fails", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT r.repair_id FROM repair_requests")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await quotations.create(
      createReq({ body: { kind: "REPAIR", repair_request_id: "r-1", price: 5000 } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("creates a drilling quotation, updates request status, broadcasts and sends LINE flex", async () => {
    const res = createRes();
    await quotations.create(
      createReq({ body: { kind: "DRILLING", drilling_request_id: 10, price: 25000, notes: "ทดสอบ" } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO quotations"),
      expect.arrayContaining(["DRILLING", 10, null])
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE drilling_requests SET status = 'QUOTED' WHERE request_id = $1",
      [10]
    );
    expect(mocks.broadcast).toHaveBeenCalledWith({
      type: "QUOTATION_CREATED",
      data: { quotation_id: 1, kind: "DRILLING" },
      orgId: "org-1",
    });
    expect(mocks.sendFlexToCustomer).toHaveBeenCalledWith(2, expect.any(String), expect.any(Object), "QUOTE", "org-1");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("creates a repair quotation and sends LINE flex", async () => {
    const res = createRes();
    await quotations.create(
      createReq({ body: { kind: "REPAIR", repair_request_id: "r-1", price: 8000 } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO quotations"),
      expect.arrayContaining(["REPAIR", null, "r-1"])
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE repair_requests SET status = 'QUOTED' WHERE repair_id = $1",
      ["r-1"]
    );
    expect(mocks.sendFlexToCustomer).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("updateStatus", () => {
  it("returns 400 when status is invalid", async () => {
    const res = createRes();
    await quotations.updateStatus(
      createReq({ params: { id: "1" }, body: { status: "BOGUS" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when quotation is not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT q.quotation_id")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await quotations.updateStatus(
      createReq({ params: { id: "999" }, body: { status: "ACCEPTED" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates status and broadcasts", async () => {
    const res = createRes();
    await quotations.updateStatus(
      createReq({ params: { id: "1" }, body: { status: "REJECTED" } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE quotations SET status = $1 WHERE quotation_id = $2",
      ["REJECTED", "1"]
    );
    expect(mocks.broadcast).toHaveBeenCalledWith({
      type: "QUOTATION_CHANGED",
      data: { quotation_id: 1, status: "REJECTED" },
      orgId: "org-1",
    });
    expect(res.json).toHaveBeenCalled();
  });

  it("cascades ACCEPTED to drilling request status", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT q.quotation_id")) return { rows: [{ quotation_id: 1 }] };
      if (sql.includes("SELECT * FROM quotations")) return { rows: [{ ...quotationRow, kind: "DRILLING" }] };
      if (sql.includes("UPDATE")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await quotations.updateStatus(
      createReq({ params: { id: "1" }, body: { status: "ACCEPTED" } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE drilling_requests SET status = 'ACCEPTED' WHERE request_id = $1",
      [10]
    );
  });

  it("cascades ACCEPTED to repair request status", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT q.quotation_id")) return { rows: [{ quotation_id: 1 }] };
      if (sql.includes("SELECT * FROM quotations")) return { rows: [{ ...quotationRow, kind: "REPAIR", drilling_request_id: null, repair_request_id: "r-1" }] };
      if (sql.includes("UPDATE")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await quotations.updateStatus(
      createReq({ params: { id: "1" }, body: { status: "ACCEPTED" } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE repair_requests SET status = 'ACCEPTED' WHERE repair_id = $1",
      ["r-1"]
    );
  });
});

describe("remove", () => {
  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT q.quotation_id")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await quotations.remove(createReq({ params: { id: "999" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes and returns 204", async () => {
    const res = createRes();
    await quotations.remove(createReq({ params: { id: "1" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "DELETE FROM quotations WHERE quotation_id = $1",
      ["1"]
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});
