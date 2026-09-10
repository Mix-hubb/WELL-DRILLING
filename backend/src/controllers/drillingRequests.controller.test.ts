import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  poolConnect: vi.fn(),
  sendTextToCustomer: vi.fn(),
  broadcast: vi.fn(),
}));
const client = { query: vi.fn(), release: vi.fn() };

vi.mock("../config/db", () => ({ pool: { query: mocks.poolQuery, connect: mocks.poolConnect } }));
vi.mock("../services/line", () => ({ sendTextToCustomer: mocks.sendTextToCustomer }));
vi.mock("../services/sse", () => ({ broadcast: mocks.broadcast }));

import * as drillingRequests from "./drillingRequests.controller";

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

const requestRow = {
  request_id: 1,
  customer_id: 2,
  source: "MANUAL",
  name: "นายสมชาย",
  phone: "0812345678",
  address: "บางกอก",
  requested_depth_m: 30,
  appointment_date: "2025-06-01",
  status: "NEW",
  notes: null,
  created_at: "2025-05-20",
  updated_at: "2025-05-20",
  customer_name: "นายสมชาย",
  customer_phone: "0812345678",
  quotation_id: null,
  quotation_price: null,
  quotation_status: null,
  quotation_notes: null,
  job_id: null,
  job_status: null,
  well_id: null,
};

const requestRowMapped = {
  request_id: 1,
  customer_id: 2,
  source: "MANUAL",
  name: "นายสมชาย",
  phone: "0812345678",
  address: "บางกอก",
  requested_depth_m: 30,
  appointment_date: "2025-06-01",
  status: "NEW",
  notes: null,
  created_at: "2025-05-20",
  updated_at: "2025-05-20",
  customer_name: "นายสมชาย",
  customer_phone: "0812345678",
  quotation: null,
  job: null,
};

beforeEach(() => {
  mocks.poolQuery.mockReset();
  mocks.poolConnect.mockReset();
  mocks.sendTextToCustomer.mockReset();
  mocks.sendTextToCustomer.mockResolvedValue(true);
  mocks.broadcast.mockReset();
  mocks.poolConnect.mockResolvedValue(client);
  client.query.mockReset();
  client.query.mockImplementation(async () => ({ rows: [] }));
  client.release.mockImplementation(() => undefined);

  mocks.poolQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM drilling_requests r")) return { rows: [requestRow] };
    if (sql.includes("FROM customers c")) return { rows: [{ customer_id: 2 }] };
    if (sql.includes("INSERT INTO drilling_requests")) return { rows: [{ request_id: 1 }] };
    if (sql.includes("UPDATE drilling_requests SET name")) return { rows: [] };
    if (sql.includes("UPDATE drilling_requests SET status")) return { rows: [] };
    return { rows: [] };
  });
});

describe("list", () => {
  it("returns the request rows", async () => {
    const res = createRes();
    await drillingRequests.list(createReq(), res);
    expect(res.json).toHaveBeenCalledWith([requestRowMapped]);
  });

  it("filters by status", async () => {
    const res = createRes();
    await drillingRequests.list(createReq({ query: { status: "NEW" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("r.status = $1"),
      expect.arrayContaining(["NEW"])
    );
  });

  it("does not filter when status is ALL", async () => {
    const res = createRes();
    await drillingRequests.list(createReq({ query: { status: "ALL" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("1=1"),
      expect.any(Array)
    );
  });
});

describe("getOne", () => {
  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM drilling_requests r")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await drillingRequests.getOne(createReq({ params: { id: "999" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the mapped request with joins", async () => {
    const res = createRes();
    await drillingRequests.getOne(createReq({ params: { id: "1" } }), res);
    expect(res.json).toHaveBeenCalledWith(requestRowMapped);
  });
});

describe("create", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = createRes();
    await drillingRequests.create(createReq({ body: { customer_id: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when customer is not found or not owned", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM customers c")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await drillingRequests.create(
      createReq({ body: { customer_id: 2, name: "test", phone: "081", address: "addr" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("creates and broadcasts", async () => {
    const res = createRes();
    await drillingRequests.create(
      createReq({ body: { customer_id: 2, name: "นายสมชาย", phone: "0812345678", address: "บางกอก" } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO drilling_requests"),
      expect.any(Array)
    );
    expect(mocks.broadcast).toHaveBeenCalledWith({
      type: "DRILLING_REQUEST_CREATED",
      data: { request_id: 1 },
      orgId: "org-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("sends LINE message when source is LINE", async () => {
    const res = createRes();
    await drillingRequests.create(
      createReq({ body: { customer_id: 2, source: "LINE", name: "test", phone: "081", address: "addr" } }),
      res
    );
    expect(mocks.sendTextToCustomer).toHaveBeenCalledWith(2, expect.any(String), "STATUS", expect.any(String));
  });

  it("does not send LINE message when source is not LINE", async () => {
    const res = createRes();
    await drillingRequests.create(
      createReq({ body: { customer_id: 2, name: "test", phone: "081", address: "addr" } }),
      res
    );
    expect(mocks.sendTextToCustomer).not.toHaveBeenCalled();
  });
});

describe("update", () => {
  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT * FROM drilling_requests r")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await drillingRequests.update(createReq({ params: { id: "999" }, body: { name: "new" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates fields and returns the request", async () => {
    const res = createRes();
    await drillingRequests.update(
      createReq({ params: { id: "1" }, body: { name: "ใหม่", phone: "0899" } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE drilling_requests SET"),
      expect.arrayContaining(["ใหม่", "0899"])
    );
    expect(res.json).toHaveBeenCalledWith(requestRowMapped);
  });
});

describe("updateStatus", () => {
  it("rejects invalid status with 400", async () => {
    const res = createRes();
    await drillingRequests.updateStatus(
      createReq({ params: { id: "1" }, body: { status: "BOGUS" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT r.request_id FROM drilling_requests")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await drillingRequests.updateStatus(
      createReq({ params: { id: "999" }, body: { status: "ACCEPTED" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates status and broadcasts", async () => {
    const res = createRes();
    await drillingRequests.updateStatus(
      createReq({ params: { id: "1" }, body: { status: "ACCEPTED" } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE drilling_requests SET status = $1 WHERE request_id = $2",
      ["ACCEPTED", "1"]
    );
    expect(mocks.broadcast).toHaveBeenCalledWith({
      type: "DRILLING_REQUEST_CHANGED",
      data: { request_id: 1, status: "ACCEPTED" },
      orgId: "org-1",
    });
    expect(res.json).toHaveBeenCalledWith(requestRowMapped);
  });
});

describe("remove", () => {
  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT r.request_id FROM drilling_requests")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await drillingRequests.remove(createReq({ params: { id: "999" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes and returns 204", async () => {
    const res = createRes();
    await drillingRequests.remove(createReq({ params: { id: "1" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "DELETE FROM drilling_requests WHERE request_id = $1",
      ["1"]
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});

describe("createFromPublicForm", () => {
  it("returns 400 when name or phone is missing", async () => {
    const res = createRes();
    await drillingRequests.createFromPublicForm(
      createReq({ body: { name: "test" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates customer + request in a transaction and broadcasts", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("SELECT customer_id FROM customers")) return { rows: [] };
      if (sql.includes("INSERT INTO customers")) return { rows: [{ customer_id: 10 }] };
      if (sql.includes("INSERT INTO drilling_requests")) return { rows: [{ request_id: 5 }] };
      return { rows: [] };
    });

    const res = createRes();
    await drillingRequests.createFromPublicForm(
      createReq({ body: { name: "นายทดสอบ", phone: "0811111111", address: "กรุงเทพ" } }),
      res
    );

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
    expect(mocks.broadcast).toHaveBeenCalledWith({
      type: "DRILLING_REQUEST_CREATED",
      data: { request_id: 5 },
      orgId: null,
    });
    expect(mocks.sendTextToCustomer).toHaveBeenCalledWith(10, expect.any(String), "STATUS", null);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ request_id: 5, customer_id: 10 });
  });
});
