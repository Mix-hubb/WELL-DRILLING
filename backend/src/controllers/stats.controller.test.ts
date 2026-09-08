import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const { poolQuery } = vi.hoisted(() => ({ poolQuery: vi.fn() }));
vi.mock("../config/db", () => ({ pool: { query: poolQuery } }));

import * as stats from "./stats.controller";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function createReq(): Request {
  return { user: {} } as unknown as Request;
}

beforeEach(() => {
  poolQuery.mockReset();
  poolQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM drilling_requests r")) {
      return { rows: [{ new_count: "2", quoted_count: "1", accepted_count: "0" }] };
    }
    if (sql.includes("COUNT(*) FILTER (WHERE j.status")) {
      return { rows: [{ queued: "1", drilling: "0", success: "2", failed: "0", closed: "0", total: "3" }] };
    }
    if (sql.includes("FROM repair_requests r")) {
      return { rows: [{ new_count: "1", in_progress_count: "2", completed_count: "3" }] };
    }
    if (sql.includes("warranty_expire_date")) {
      return { rows: [{ warranty_active: "4", warranty_expiring_soon: "1", warranty_expired: "2" }] };
    }
    if (sql.includes("COALESCE(AVG(w.total_depth_m)")) {
      return { rows: [{ well_count: "5", avg_depth: "100", max_depth: "200", avg_water: "10" }] };
    }
    if (sql.includes("LIMIT 6")) {
      return { rows: [{ job_id: 1, job_title: "งาน", status: "QUEUED" }] };
    }
    return { rows: [] };
  });
});

describe("overview", () => {
  it("returns a fully-shaped StatsOverview", async () => {
    const res = createRes();
    await stats.overview(createReq(), res);

    expect(poolQuery).toHaveBeenCalledTimes(6);
    expect(res.json).toHaveBeenCalledWith({
      requests: { new: 2, quoted: 1, accepted: 0 },
      jobs: { queued: 1, drilling: 0, success: 2, failed: 0, closed: 0, total: 3 },
      repairs: { new: 1, inProgress: 2, completed: 3 },
      wells: { count: 5, avgDepth: 100, maxDepth: 200, avgWater: 10 },
      warranty: { active: 4, expiringSoon: 1, expired: 2 },
      recentJobs: [{ job_id: 1, job_title: "งาน", status: "QUEUED" }],
    });
  });

  it("coerces missing/null counters to zero", async () => {
    poolQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM drilling_requests r")) return { rows: [{ new_count: null, quoted_count: null, accepted_count: null }] };
      if (sql.includes("COUNT(*) FILTER (WHERE j.status")) return { rows: [{ queued: null, drilling: null, success: null, failed: null, closed: null, total: null }] };
      if (sql.includes("FROM repair_requests r")) return { rows: [{ new_count: null, in_progress_count: null, completed_count: null }] };
      if (sql.includes("warranty_expire_date")) return { rows: [{ warranty_active: null, warranty_expiring_soon: null, warranty_expired: null }] };
      if (sql.includes("COALESCE(AVG(w.total_depth_m)")) return { rows: [{ well_count: null, avg_depth: null, max_depth: null, avg_water: null }] };
      if (sql.includes("LIMIT 6")) return { rows: [] };
      return { rows: [] };
    });

    const res = createRes();
    await stats.overview(createReq(), res);
    const output = res.json.mock.calls[0][0];
    expect(output.requests).toEqual({ new: 0, quoted: 0, accepted: 0 });
    expect(output.jobs).toEqual({ queued: 0, drilling: 0, success: 0, failed: 0, closed: 0, total: 0 });
  });
});