import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  poolConnect: vi.fn(),
  broadcast: vi.fn(),
}));
const client = { query: vi.fn(), release: vi.fn() };

vi.mock("../config/db", () => ({ pool: { query: mocks.poolQuery, connect: mocks.poolConnect } }));
vi.mock("../services/sse", () => ({ broadcast: mocks.broadcast }));

import * as wells from "./wells.controller";

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

const wellRow = { well_id: 1, customer_id: 1, well_name: "บ่อบ้าน", warranty_status: "ACTIVE" };

function setDefaultPoolQuery() {
  mocks.poolQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM wells w")) return { rows: [wellRow] };
    if (sql.includes("FROM customers c")) return { rows: [{ customer_id: 1 }] };
    if (sql.includes("FROM well_strata_logs")) return { rows: [{ strata_id: 1 }] };
    if (sql.includes("FROM well_pipes")) return { rows: [{ pipe_id: 1 }] };
    if (sql.includes("FROM well_pumps")) return { rows: [{ pump_id: 1 }] };
    if (sql.includes("FROM well_control_boxes")) return { rows: [{ control_box_id: 1 }] };
    if (sql.includes("INSERT INTO")) return { rows: [{ ...wellRow, inserted: true }] };
    return { rows: [] };
  });
}

beforeEach(() => {
  mocks.poolQuery.mockReset();
  mocks.poolConnect.mockReset();
  mocks.broadcast.mockReset();
  mocks.poolConnect.mockResolvedValue(client);
  client.query.mockReset();
  client.query.mockImplementation(async () => ({ rows: [] }));
  client.release.mockImplementation(() => undefined);
  setDefaultPoolQuery();
});

describe("list", () => {
  it("returns all wells for the user's org", async () => {
    const res = createRes();
    await wells.list(createReq(), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(expect.stringContaining("JOIN customers c"), ["org-1"]);
    expect(res.json).toHaveBeenCalledWith([wellRow]);
  });
});

describe("getOne", () => {
  it("returns 404 when the well is missing", async () => {
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM wells w")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await wells.getOne(createReq({ params: { id: "999" } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("assembles the full well with strata/pipes/pumps/control boxes", async () => {
    const res = createRes();
    await wells.getOne(createReq({ params: { id: "1" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledTimes(5);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        well_id: 1,
        strata: [{ strata_id: 1 }],
        pipes: [{ pipe_id: 1 }],
        pumps: [{ pump_id: 1 }],
        control_boxes: [{ control_box_id: 1 }],
      })
    );
  });
});

describe("create", () => {
  it("returns 400 when customer_id is missing", async () => {
    const res = createRes();
    await wells.create(createReq({ body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "ต้องระบุ customer_id" });
  });

  it("creates a top-level well, broadcasts and returns 201", async () => {
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("INSERT INTO wells")) return { rows: [{ well_id: 1 }] };
      if (sql.includes("UPDATE drilling_jobs")) return { rows: [] };
      return { rows: [] };
    });
    mocks.poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM wells w")) return { rows: [wellRow] };
      if (sql.includes("FROM customers c")) return { rows: [{ customer_id: 1 }] };
      return { rows: [] };
    });
    const res = createRes();
    await wells.create(
      createReq({
        body: { customer_id: 1, job_id: 5, well_name: "บ่อใหม่", total_depth_m: 120 },
      }),
      res
    );

    expect(mocks.poolConnect).toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    const insertCall = client.query.mock.calls.find((c) => String(c[0]).includes("INSERT INTO wells"));
    expect(insertCall![1]).toContain(1);
    expect(insertCall![1]).toContain("บ่อใหม่");
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE drilling_jobs SET well_id"),
      [1, 5]
    );
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(mocks.broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "WELL_CREATED", orgId: "org-1" })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe("remove", () => {
  it("deletes the well, broadcasts and returns 204", async () => {
    const res = createRes();
    await wells.remove(createReq({ params: { id: "1" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith("DELETE FROM wells WHERE well_id = $1", ["1"]);
    expect(mocks.broadcast).toHaveBeenCalledWith({ type: "WELL_UPDATED", data: { well_id: 1 }, orgId: "org-1" });
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe("strata / pipes / pumps / control boxes", () => {
  it("addStrata validates depths", async () => {
    const res = createRes();
    await wells.addStrata(createReq({ params: { wellId: "1" }, body: { depth_from_m: 0 } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.poolQuery).not.toHaveBeenCalled();
  });

  it("addStrata inserts and broadcasts", async () => {
    const res = createRes();
    await wells.addStrata(
      createReq({
        params: { wellId: "1" },
        body: { depth_from_m: 0, depth_to_m: 10, lithology_type: "CLAY", water_bearing: 1 },
      }),
      res
    );
    const [sql, params] = mocks.poolQuery.mock.calls[1];
    expect(sql).toContain("INSERT INTO well_strata_logs");
    expect(params[0]).toBe("1");
    expect(params[3]).toBe("CLAY");
    expect(params[7]).toBe(true);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mocks.broadcast).toHaveBeenCalled();
  });

  it("removeStrata returns 204", async () => {
    const res = createRes();
    await wells.removeStrata(createReq({ params: { wellId: "1", strataId: "9" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "DELETE FROM well_strata_logs WHERE strata_id = $1",
      ["9"]
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("addPipe validates depths", async () => {
    const res = createRes();
    await wells.addPipe(createReq({ params: { wellId: "1" }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("addPipe inserts with quantity defaulting to 1", async () => {
    const res = createRes();
    await wells.addPipe(
      createReq({
        params: { wellId: "1" },
        body: { depth_from_m: 0, depth_to_m: 20, material: "PVC" },
      }),
      res
    );
    const [sql, params] = mocks.poolQuery.mock.calls[1];
    expect(sql).toContain("INSERT INTO well_pipes");
    expect(params[6]).toBe(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("removePipe returns 204", async () => {
    const res = createRes();
    await wells.removePipe(createReq({ params: { wellId: "1", pipeId: "2" } }), res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("addPump inserts a new pump", async () => {
    const res = createRes();
    await wells.addPump(
      createReq({
        params: { wellId: "1" },
        body: { pump_type: "AC_SUBMERSIBLE", brand: "Franklin" },
      }),
      res
    );
    const [sql, params] = mocks.poolQuery.mock.calls[1];
    expect(sql).toContain("INSERT INTO well_pumps");
    expect(params[1]).toBe("AC_SUBMERSIBLE");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("removePump returns 204", async () => {
    const res = createRes();
    await wells.removePump(createReq({ params: { wellId: "1", pumpId: "3" } }), res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("addControlBox inserts a new control box", async () => {
    const res = createRes();
    await wells.addControlBox(
      createReq({ params: { wellId: "1" }, body: { brand: "X", model: "Y" } }),
      res
    );
    const [sql, params] = mocks.poolQuery.mock.calls[1];
    expect(sql).toContain("INSERT INTO well_control_boxes");
    expect(params[1]).toBe("X");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("removeControlBox returns 204", async () => {
    const res = createRes();
    await wells.removeControlBox(createReq({ params: { wellId: "1", controlBoxId: "4" } }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      "DELETE FROM well_control_boxes WHERE control_box_id = $1",
      ["4"]
    );
    expect(res.status).toHaveBeenCalledWith(204);
  });
});