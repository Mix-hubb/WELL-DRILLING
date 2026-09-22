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

import * as jobs from "./jobs.controller";

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

const jobRow = {
  job_id: 1,
  customer_id: 2,
  job_title: "เจาะบ่อหลังบ้าน",
  status: "QUEUED",
  customer_name: "นายสมชาย",
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
    if (sql.includes("SELECT well_id FROM drilling_jobs")) return { rows: [] };
    if (sql.includes("INSERT INTO drilling_jobs")) return { rows: [{ job_id: 1 }] };
    if (sql.includes("FROM drilling_jobs j")) return { rows: [jobRow] };
    if (sql.includes("FROM customers c")) return { rows: [{ customer_id: 2 }] };
    if (sql.includes("UPDATE drilling_requests SET status")) return { rows: [] };
    if (sql.includes("SELECT * FROM drilling_requests")) return { rows: [] };
    return { rows: [] };
  });
});

describe("list", () => {
  it("returns jobs for the org (default)", async () => {
    const res = createRes();
    await jobs.list(createReq(), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("WHERE 1=1 AND j.status != 'ARCHIVED'"),
      ["org-1"]
    );
    expect(res.json).toHaveBeenCalledWith([jobRow]);
  });

  it("passes a status filter as $1", async () => {
    const res = createRes();
    await jobs.list(createReq({ query: { status: "DRILLING" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("j.status = $1"),
      ["DRILLING", "org-1"]
    );
  });
});

describe("getOne", () => {
  it("returns 404 when the job is missing", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM drilling_jobs j")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await jobs.getOne(createReq({ params: { id: "9" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("attaches the drilling request when present", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM drilling_jobs j")) return { rows: [{ ...jobRow, request_id: 7 }] };
      if (sql.includes("FROM drilling_requests")) return { rows: [{ request_id: 1 }] };
      return { rows: [] };
    });
    const res = createRes();
    await jobs.getOne(createReq({ params: { id: "1" } }), res);
    expect(res.json).toHaveBeenCalledWith({ ...jobRow, request_id: 7, request: { request_id: 1 } });
  });
});

describe("getByMagicToken", () => {
  it("returns 404 for an invalid or expired link", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM drilling_jobs j")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await jobs.getByMagicToken(createReq({ params: { token: "drill-dead" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the job for a valid token", async () => {
    const res = createRes();
    await jobs.getByMagicToken(createReq({ params: { token: "drill-live" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("magic_link_token = $1"),
      ["drill-live"]
    );
    expect(res.json).toHaveBeenCalledWith(jobRow);
  });
});

describe("create", () => {
  it("returns 400 when customer_id is missing", async () => {
    const res = createRes();
    await jobs.create(createReq({ body: { job_title: "งาน" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("creates a job with a magic token and accepts the request", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM customers c WHERE c.customer_id")) return { rows: [{ customer_id: 2 }] };
      if (sql.includes("FROM drilling_requests r")) return { rows: [{ status: "NEW", job_id: null }] };
      if (sql.includes("INSERT INTO drilling_jobs")) return { rows: [{ job_id: 1 }] };
      if (sql.includes("FROM drilling_jobs j")) return { rows: [jobRow] };
      return { rows: [] };
    });
    const res = createRes();
    await jobs.create(
      createReq({ body: { customer_id: 2, request_id: 7, job_title: "เจาะบ่อ" } }),
      res
    );

    const insertCall = mocks.poolQuery.mock.calls.find((c) => String(c[0]).includes("INSERT INTO drilling_jobs"));
    expect(insertCall![1][0]).toBe(7);
    expect(insertCall![1][1]).toBe(2);
    expect(String(insertCall![1][8])).toMatch(/^drill-[0-9a-f]{32}$/);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE drilling_requests SET status = 'ACCEPTED' WHERE request_id = $1",
      [7]
    );
    expect(mocks.broadcast).toHaveBeenCalledWith({ type: "JOB_CREATED", data: { job_id: 1 }, orgId: "org-1" });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("update", () => {
  it("returns 404 when the job is missing", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM drilling_jobs j")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await jobs.update(createReq({ params: { id: "1" }, body: { job_title: "ใหม่" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates merged fields", async () => {
    const res = createRes();
    await jobs.update(
      createReq({
        params: { id: "1" },
        body: { job_title: "ใหม่" },
      }),
      res
    );
    const updateCall = mocks.poolQuery.mock.calls.find((c) => String(c[0]).includes("UPDATE drilling_jobs SET job_title"));
    expect(updateCall).toBeDefined();
    expect(updateCall![1][0]).toBe("ใหม่");
    expect(res.json).toHaveBeenCalledWith(jobRow);
  });
});

describe("updateStatus", () => {
  it("rejects an invalid status", async () => {
    const res = createRes();
    await jobs.updateStatus(createReq({ params: { id: "1" }, body: { status: "BOGUS" } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 404 when the job disappears after update", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM drilling_jobs j")) return { rows: [] };
      if (sql.includes("UPDATE drilling_jobs SET status")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await jobs.updateStatus(createReq({ params: { id: "1" }, body: { status: "SUCCESS" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("updates status and broadcasts", async () => {
    const res = createRes();
    await jobs.updateStatus(
      createReq({ params: { id: "1" }, body: { status: "DRILLING" } }),
      res
    );
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE drilling_jobs SET status = $1 WHERE job_id = $2",
      ["DRILLING", "1"]
    );
    expect(mocks.broadcast).toHaveBeenCalledWith({
      type: "JOB_STATUS_CHANGED",
      data: { job_id: "1", status: "DRILLING" },
      orgId: "org-1",
    });
    expect(res.json).toHaveBeenCalledWith(jobRow);
  });

  it("persists result alongside status when marking SUCCESS", async () => {
    const res = createRes();
    await jobs.updateStatus(createReq({ params: { id: "1" }, body: { status: "SUCCESS" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE drilling_jobs SET status = $1, result = $1 WHERE job_id = $2",
      ["SUCCESS", "1"]
    );
  });

  it("persists result alongside status when marking FAILED", async () => {
    const res = createRes();
    await jobs.updateStatus(createReq({ params: { id: "1" }, body: { status: "FAILED" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE drilling_jobs SET status = $1, result = $1 WHERE job_id = $2",
      ["FAILED", "1"]
    );
  });

  it("does not touch result when closing a job", async () => {
    const res = createRes();
    await jobs.updateStatus(createReq({ params: { id: "1" }, body: { status: "CLOSED" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "UPDATE drilling_jobs SET status = $1 WHERE job_id = $2",
      ["CLOSED", "1"]
    );
  });
});

describe("completeWell", () => {
  const jobWithoutWell = { ...jobRow, well_id: null, magic_link_token: "drill-tok", customer_id: 2 };

  function setUp(extraBranch: (sql: string) => { rows: any[] } | undefined) {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM drilling_jobs j")) return { rows: [{ ...jobRow, well_id: 1 }] };
      return extraBranch(sql) || { rows: [] };
    });
    // job lookup now happens inside the transaction (SELECT ... FOR UPDATE via client.query)
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT * FROM drilling_jobs")) return { rows: [jobWithoutWell] };
      if (sql.includes("INSERT INTO wells")) return { rows: [{ well_id: 1 }] };
      if (sql.includes("UPDATE drilling_jobs")) return { rows: [] };
      return { rows: [] };
    });
  }

  it("returns 404 when the job is missing", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT * FROM drilling_jobs")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await jobs.completeWell(createReq({ params: { id: "9" }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 403 when an invalid magic token is supplied", async () => {
    setUp(() => undefined);
    const res = createRes();
    await jobs.completeWell(
      createReq({ params: { id: "1" }, body: { magic_token: "drill-wrong" } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("creates the well, updates the job and notifies the customer", async () => {
    setUp(() => undefined);
    mocks.sendTextToCustomer.mockResolvedValueOnce(true);

    const res = createRes();
    await jobs.completeWell(
      createReq({
        params: { id: "1" },
        body: { total_depth_m: 120, strata: [{ depth_from_m: 0, depth_to_m: 5 }], pipes: [], pumps: [], control_boxes: [] },
      }),
      res
    );

    expect(mocks.poolConnect).toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    const insertWell = client.query.mock.calls.find((c) => String(c[0]).includes("INSERT INTO wells"));
    expect(insertWell![1][0]).toBe(2);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(mocks.sendTextToCustomer).toHaveBeenCalledWith(2, expect.any(String), "STATUS", undefined);
    expect(mocks.broadcast).toHaveBeenCalled();
    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "WELL_CREATED" })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ job_id: 1 }));
  });

  it("stores 'FAILED' (not 'FAIL') on drilling_jobs when the driller reports a failed result", async () => {
    setUp(() => undefined);

    const res = createRes();
    await jobs.completeWell(
      createReq({
        params: { id: "1" },
        body: { total_depth_m: 50, result: "FAIL", failure_reason: "เจอหินแข็ง", strata: [], pipes: [], pumps: [], control_boxes: [] },
      }),
      res
    );

    const updateJob = client.query.mock.calls.find((c) => String(c[0]).includes("UPDATE drilling_jobs"));
    expect(updateJob![1]).toContain("FAILED");
    expect(updateJob![1]).not.toContain("FAIL");
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it("rejects a stratum deeper than the submitted total_depth_m", async () => {
    setUp(() => undefined);
    const res = createRes();
    await jobs.completeWell(
      createReq({
        params: { id: "1" },
        body: { total_depth_m: 50, strata: [{ depth_from_m: 40, depth_to_m: 60 }], pipes: [], pumps: [], control_boxes: [] },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.poolConnect).not.toHaveBeenCalled();
  });

  it("rejects overlapping strata ranges", async () => {
    setUp(() => undefined);
    const res = createRes();
    await jobs.completeWell(
      createReq({
        params: { id: "1" },
        body: {
          total_depth_m: 100,
          strata: [{ depth_from_m: 0, depth_to_m: 20 }, { depth_from_m: 10, depth_to_m: 30 }],
          pipes: [], pumps: [], control_boxes: [],
        },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.poolConnect).not.toHaveBeenCalled();
  });

  it("resubmitting the same magic link updates the existing well instead of creating a duplicate, and does not notify the customer again", async () => {
    const jobWithWell = { ...jobRow, well_id: 1, magic_link_token: "drill-tok", customer_id: 2 };
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM drilling_jobs j")) return { rows: [{ ...jobRow, well_id: 1 }] };
      return { rows: [] };
    });
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT * FROM drilling_jobs")) return { rows: [jobWithWell] };
      if (sql.includes("UPDATE wells")) return { rows: [] };
      if (sql.includes("UPDATE drilling_jobs")) return { rows: [] };
      return { rows: [] };
    });

    const res = createRes();
    await jobs.completeWell(
      createReq({
        params: { id: "1" },
        body: { total_depth_m: 120, strata: [], pipes: [], pumps: [], control_boxes: [] },
      }),
      res
    );

    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO wells"), expect.any(Array));
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE wells"), expect.any(Array));
    expect(mocks.sendTextToCustomer).not.toHaveBeenCalled();
    expect(mocks.broadcast).toHaveBeenCalledWith(expect.objectContaining({ type: "WELL_UPDATED" }));
    expect(mocks.broadcast).not.toHaveBeenCalledWith(expect.objectContaining({ type: "WELL_CREATED" }));
  });

  it("locks the job row FOR UPDATE to serialize concurrent/duplicate submissions", async () => {
    setUp(() => undefined);
    const res = createRes();
    await jobs.completeWell(
      createReq({
        params: { id: "1" },
        body: { total_depth_m: 50, strata: [], pipes: [], pumps: [], control_boxes: [] },
      }),
      res
    );
    const lookup = client.query.mock.calls.find((c) => String(c[0]).includes("SELECT * FROM drilling_jobs"));
    expect(String(lookup![0])).toContain("FOR UPDATE");
  });
});

describe("remove / generateMagicLink", () => {
  it("remove deletes and returns 204", async () => {
    const res = createRes();
    await jobs.remove(createReq({ params: { id: "1" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith("DELETE FROM drilling_jobs WHERE job_id = $1", ["1"]);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("generateMagicLink regenerates the token", async () => {
    const res = createRes();
    await jobs.generateMagicLink(createReq({ params: { id: "1" } }), res);
    const call = mocks.poolQuery.mock.calls[1];
    expect(call[0]).toContain("UPDATE drilling_jobs SET magic_link_token");
    expect(String(call[1][0])).toMatch(/^drill-[0-9a-f]{32}$/);
    expect(res.json).toHaveBeenCalledWith({ token: expect.any(String) });
    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "JOB_MAGIC_LINK_CHANGED", orgId: "org-1" })
    );
  });
});