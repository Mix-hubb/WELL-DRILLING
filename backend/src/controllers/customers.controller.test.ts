import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock("../config/db", () => ({ pool: { query: poolQuery } }));

import * as customers from "./customers.controller";

function createRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn();
  return res;
}

function createReq(overrides: Record<string, any> = {}): Request {
  return { body: {}, params: {}, query: {}, user: {}, ...overrides } as unknown as Request;
}

beforeEach(() => {
  poolQuery.mockReset();
});

const customerRow = {
  customer_id: 1,
  customer_name: "นายสมชาย",
  phone: "0812345678",
  org_id: "org-1",
};

describe("list", () => {
  it("returns the customer rows", async () => {
    poolQuery.mockResolvedValueOnce({ rows: [customerRow] });
    const res = createRes();
    await customers.list(createReq(), res);
    expect(poolQuery).toHaveBeenCalledWith(expect.stringContaining("FROM customers"), []);
    expect(res.json).toHaveBeenCalledWith([customerRow]);
  });
});

describe("getOne", () => {
  it("returns 404 when the customer does not exist", async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await customers.getOne(createReq({ params: { id: "999" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns customer with well count", async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [customerRow] })
      .mockResolvedValueOnce({ rows: [{ total_wells: "3" }] });
    const res = createRes();
    await customers.getOne(createReq({ params: { id: "1" } }), res);
    expect(res.json).toHaveBeenCalledWith({ ...customerRow, total_wells: 3 });
  });
});

describe("getOverview", () => {
  it("returns 404 when the customer does not exist", async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await customers.getOverview(createReq({ params: { id: "1" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("collects wells, jobs, requests and repairs", async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [customerRow] })
      .mockResolvedValueOnce({ rows: [{ well_id: 1 }] })
      .mockResolvedValueOnce({ rows: [{ job_id: 2 }] })
      .mockResolvedValueOnce({ rows: [{ request_id: 3 }] })
      .mockResolvedValueOnce({ rows: [{ repair_id: 4 }] });

    const res = createRes();
    await customers.getOverview(createReq({ params: { id: "1" } }), res);

    expect(poolQuery).toHaveBeenCalledTimes(5);
    expect(res.json).toHaveBeenCalledWith({
      customer: customerRow,
      wells: [{ well_id: 1 }],
      jobs: [{ job_id: 2 }],
      drillingRequests: [{ request_id: 3 }],
      repairRequests: [{ repair_id: 4 }],
    });
  });

  it("filters customer by org_id when present", async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [customerRow] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const res = createRes();
    await customers.getOverview(createReq({ params: { id: "1" }, user: { orgId: "org-1" } }), res);
    expect(poolQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("customer_id = $1 AND customers.org_id = $2"),
      ["1", "org-1"]
    );
  });
});

describe("create", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = createRes();
    await customers.create(createReq({ body: { customer_name: "ชื่อ" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates a customer with the requesting user", async () => {
    poolQuery.mockResolvedValueOnce({ rows: [customerRow] });
    const res = createRes();
    const req = createReq({
      body: { customer_name: "นายสมชาย", phone: "0812345678", address: "บางกอก" },
      user: { userId: "u-1", orgId: "org-1" },
    });
    await customers.create(req, res);
    const [sql, params] = poolQuery.mock.calls[0];
    expect(sql).toContain("INSERT INTO customers");
    expect(params).toEqual(["u-1", "org-1", "นายสมชาย", "0812345678", null, "บางกอก"]);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("update", () => {
  it("returns 404 when the customer does not exist after update", async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await customers.update(createReq({ params: { id: "1" }, body: { customer_name: "ใหม่", phone: "0812" } }), res);
    expect(poolQuery).toHaveBeenCalledWith("SELECT * FROM customers WHERE customer_id = $1", ["1"]);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates and returns the customer", async () => {
    poolQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [customerRow] });
    const res = createRes();
    await customers.update(createReq({ params: { id: "1" }, body: { customer_name: "ใหม่", phone: "0812" } }), res);
    const [sql, params] = poolQuery.mock.calls[0];
    expect(sql).toContain("UPDATE customers SET");
    expect(params).toEqual(["ใหม่", "0812", null, null, "1"]);
    expect(res.json).toHaveBeenCalledWith(customerRow);
  });
});

describe("remove", () => {
  it("deletes and returns 204", async () => {
    poolQuery.mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await customers.remove(createReq({ params: { id: "1" } }), res);
    expect(poolQuery).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM customers"), ["1"]);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});