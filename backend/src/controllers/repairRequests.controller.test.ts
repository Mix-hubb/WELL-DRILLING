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

import * as repairRequests from "./repairRequests.controller";

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

const repairRow = {
  repair_id: 1,
  customer_id: 2,
  well_id: 10,
  problems: '["รั่ว","ตัน"]',
  detail: "น้ำไม่ไหล",
  photos: null,
  scheduled_date: "2025-06-15",
  status: "NEW",
  magic_link_token: "repair-abc123",
  magic_link_expires_at: "2025-12-31",
  created_at: "2025-05-20",
  updated_at: "2025-05-20",
  customer_name: "นายสมชาย",
  customer_phone: "0812345678",
  well_name: "บ่อหลังบ้าน",
  quotation_id: null,
  quotation_price: null,
  quotation_status: null,
  quotation_notes: null,
};

const repairRowMapped = {
  repair_id: 1,
  customer_id: 2,
  well_id: 10,
  problems: ["รั่ว", "ตัน"],
  detail: "น้ำไม่ไหล",
  photos: [],
  scheduled_date: "2025-06-15",
  status: "NEW",
  magic_link_token: "repair-abc123",
  magic_link_expires_at: "2025-12-31",
  created_at: "2025-05-20",
  updated_at: "2025-05-20",
  customer_name: "นายสมชาย",
  customer_phone: "0812345678",
  well_name: "บ่อหลังบ้าน",
  quotation: null,
  records: [],
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
    if (sql.includes("FROM repair_requests r")) return { rows: [repairRow] };
    if (sql.includes("FROM repair_records")) return { rows: [] };
    if (sql.includes("FROM customers c")) return { rows: [{ customer_id: 2 }] };
    if (sql.includes("INSERT INTO repair_requests")) return { rows: [{ repair_id: 1 }] };
    if (sql.includes("UPDATE repair_requests SET")) return { rows: [] };
    return { rows: [] };
  });
});

describe("list", () => {
  it("returns repair request rows with records", async () => {
    const res = createRes();
    await repairRequests.list(createReq(), res);
    expect(res.json).toHaveBeenCalledWith([repairRowMapped]);
  });

  it("attaches records to each row", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM repair_requests r")) return { rows: [repairRow] };
      if (sql.includes("FROM repair_records")) return { rows: [{ record_id: "rec-1", repair_id: 1 }] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.list(createReq(), res);
    const result = res.json.mock.calls[0][0];
    expect(result[0].records).toEqual([{ record_id: "rec-1", repair_id: 1 }]);
  });

  it("filters by status", async () => {
    const res = createRes();
    await repairRequests.list(createReq({ query: { status: "NEW" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("r.status = $1"),
      expect.arrayContaining(["NEW"])
    );
  });

  it("does not filter when status is ALL", async () => {
    const res = createRes();
    await repairRequests.list(createReq({ query: { status: "ALL" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("1=1"),
      expect.any(Array)
    );
  });
});

describe("getOne", () => {
  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM repair_requests r")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.getOne(createReq({ params: { id: "999" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the request with records attached", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM repair_requests r")) return { rows: [repairRow] };
      if (sql.includes("FROM repair_records")) return { rows: [{ record_id: "rec-1", repair_id: 1 }] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.getOne(createReq({ params: { id: "1" } }), res);
    const result = res.json.mock.calls[0][0];
    expect(result.repair_id).toBe(1);
    expect(result.records).toEqual([{ record_id: "rec-1", repair_id: 1 }]);
  });
});

describe("create", () => {
  it("returns 400 when customer_id or problems are missing", async () => {
    const res = createRes();
    await repairRequests.create(createReq({ body: { customer_id: 1 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when customer is not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM customers c")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.create(
      createReq({ body: { customer_id: 2, problems: ["รั่ว"] } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("creates and broadcasts", async () => {
    const res = createRes();
    await repairRequests.create(
      createReq({ body: { customer_id: 2, problems: ["รั่ว", "ตัน"] } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO repair_requests"),
      expect.any(Array)
    );
    expect(mocks.broadcast).toHaveBeenCalledWith({
      type: "REPAIR_REQUEST_CREATED",
      data: { repair_id: 1 },
      orgId: "org-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("update", () => {
  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT r.* FROM repair_requests r")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.update(createReq({ params: { id: "999" }, body: { detail: "new" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates fields and returns the request", async () => {
    const res = createRes();
    await repairRequests.update(
      createReq({ params: { id: "1" }, body: { detail: "แก้ไขแล้ว" } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE repair_requests SET"),
      expect.any(Array)
    );
    const result = res.json.mock.calls[0][0];
    expect(result).toEqual(expect.objectContaining({ repair_id: 1, detail: "น้ำไม่ไหล" }));
    expect(result).not.toHaveProperty("records");
  });
});

describe("updateStatus", () => {
  it("rejects invalid status with 400", async () => {
    const res = createRes();
    await repairRequests.updateStatus(
      createReq({ params: { id: "1" }, body: { status: "BOGUS" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT r.repair_id, r.customer_id FROM repair_requests")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.updateStatus(
      createReq({ params: { id: "999" }, body: { status: "IN_PROGRESS" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates status and broadcasts", async () => {
    const res = createRes();
    await repairRequests.updateStatus(
      createReq({ params: { id: "1" }, body: { status: "ACCEPTED" } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE repair_requests SET status = $1 WHERE repair_id = $2",
      ["ACCEPTED", "1"]
    );
    expect(mocks.broadcast).toHaveBeenCalledWith({
      type: "REPAIR_REQUEST_CHANGED",
      data: { repair_id: 1, status: "ACCEPTED" },
      orgId: "org-1",
    });
    expect(res.json).toHaveBeenCalled();
  });

  it("sends LINE message when status is IN_PROGRESS", async () => {
    const res = createRes();
    await repairRequests.updateStatus(
      createReq({ params: { id: "1" }, body: { status: "IN_PROGRESS" } }),
      res
    );
    expect(mocks.sendTextToCustomer).toHaveBeenCalledWith(2, expect.any(String), "STATUS");
  });

  it("sends LINE message with liff URL when status is CLOSED", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT r.repair_id, r.customer_id FROM repair_requests")) return { rows: [{ repair_id: 1, customer_id: 2 }] };
      if (sql.includes("FROM repair_requests r")) return { rows: [repairRow] };
      if (sql.includes("FROM repair_records")) return { rows: [] };
      if (sql.includes("UPDATE repair_requests SET status")) return { rows: [] };
      if (sql.includes("line_liff_id_repair")) return { rows: [{ line_liff_id_repair: "liff-123" }] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.updateStatus(
      createReq({ params: { id: "1" }, body: { status: "CLOSED" } }),
      res
    );
    expect(mocks.sendTextToCustomer).toHaveBeenCalledWith(
      2,
      expect.stringContaining("การซ่อมบำรุงเสร็จเรียบร้อยแล้ว"),
      "STATUS"
    );
  });
});

describe("getByMagicToken", () => {
  it("returns 404 for invalid token", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM repair_requests r")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.getByMagicToken(createReq({ params: { token: "bad-token" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the repair request for a valid token", async () => {
    const res = createRes();
    await repairRequests.getByMagicToken(createReq({ params: { token: "repair-abc123" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("magic_link_token = $1"),
      ["repair-abc123"]
    );
    expect(res.json).toHaveBeenCalled();
  });
});

describe("addRecord", () => {
  it("returns 404 when request not found or expired", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT * FROM repair_requests")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.addRecord(createReq({ params: { id: "1" }, body: { magic_token: "repair-abc123" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 403 when token is invalid", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT * FROM repair_requests")) return { rows: [{ ...repairRow, magic_link_token: "repair-correct" }] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.addRecord(
      createReq({ params: { id: "1" }, body: { magic_token: "repair-wrong" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("creates record, updates status and sends LINE message", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT * FROM repair_requests")) return { rows: [{ ...repairRow, magic_link_token: "repair-abc123" }] };
      if (sql.includes("INSERT INTO repair_records")) return { rows: [{ record_id: "rec-1" }] };
      if (sql.includes("UPDATE repair_requests SET status")) return { rows: [] };
      if (sql.includes("SELECT * FROM repair_records")) return { rows: [{ record_id: "rec-1", repair_id: 1, final_price: 500, work_details: "เปลี่ยนปั๊ม" }] };
      if (sql.includes("repair_requests r JOIN customers")) return { rows: [{ customer_id: 2, org_id: "org-1" }] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.addRecord(
      createReq({
        params: { id: "1" },
        body: { magic_token: "repair-abc123", final_price: 500, work_details: "เปลี่ยนปั๊ม" },
      }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO repair_records"),
      expect.any(Array)
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE repair_requests SET status = 'COMPLETED' WHERE repair_id = $1",
      ["1"]
    );
    expect(mocks.sendTextToCustomer).toHaveBeenCalledWith(2, expect.any(String), "STATUS");
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("remove", () => {
  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT r.repair_id FROM repair_requests")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.remove(createReq({ params: { id: "999" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("deletes and returns 204", async () => {
    const res = createRes();
    await repairRequests.remove(createReq({ params: { id: "1" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "DELETE FROM repair_requests WHERE repair_id = $1",
      ["1"]
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalled();
  });
});

describe("generateMagicLink", () => {
  it("returns 404 when not found", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT r.repair_id FROM repair_requests")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await repairRequests.generateMagicLink(createReq({ params: { id: "999" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("regenerates the token", async () => {
    const res = createRes();
    await repairRequests.generateMagicLink(createReq({ params: { id: "1" } }), res);
    const updateCall = mocks.poolQuery.mock.calls.find((c) =>
      String(c[0]).includes("UPDATE repair_requests SET magic_link_token")
    );
    expect(updateCall).toBeDefined();
    expect(String(updateCall![1][0])).toMatch(/^repair-[0-9a-f]{32}$/);
    expect(res.json).toHaveBeenCalledWith({ token: expect.any(String) });
  });
});

describe("createFromPublicForm", () => {
  it("returns 400 when name, phone, or problems are missing", async () => {
    const res = createRes();
    await repairRequests.createFromPublicForm(
      createReq({ body: { name: "test" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates customer + repair in a transaction and broadcasts", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") return { rows: [] };
      if (sql.includes("SELECT customer_id FROM customers")) return { rows: [] };
      if (sql.includes("INSERT INTO customers")) return { rows: [{ customer_id: 10 }] };
      if (sql.includes("SELECT well_id FROM wells")) return { rows: [] };
      if (sql.includes("INSERT INTO repair_requests")) return { rows: [{ repair_id: 100 }] };
      return { rows: [] };
    });

    const res = createRes();
    await repairRequests.createFromPublicForm(
      createReq({ body: { name: "นายทดสอบ", phone: "0811111111", problems: ["รั่ว"] } }),
      res
    );

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
    expect(mocks.broadcast).toHaveBeenCalledWith({
      type: "REPAIR_REQUEST_CREATED",
      data: { repair_id: 100 },
      orgId: null,
    });
    expect(mocks.sendTextToCustomer).toHaveBeenCalledWith(10, expect.any(String), "STATUS");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ repair_id: 100, customer_id: 10 });
  });
});
