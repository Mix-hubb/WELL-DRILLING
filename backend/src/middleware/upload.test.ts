import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
}));

vi.mock("../config/db", () => ({
  pool: { query: mocks.poolQuery },
}));

import { magicAuth, magicResourceAuth } from "./upload";

function createRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function createReq(id: string, token: string): Request {
  return {
    params: { id },
    query: {},
    headers: { "x-magic-token": token },
    body: {},
  } as unknown as Request;
}

describe("magicResourceAuth", () => {
  beforeEach(() => mocks.poolQuery.mockReset());

  it("checks the job id and token together", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ ok: 1 }] });
    const next = vi.fn() as unknown as NextFunction;
    const res = createRes();

    await magicResourceAuth("job")(createReq("job-1", "token-1"), res, next);

    expect(mocks.poolQuery).toHaveBeenCalledWith(expect.stringContaining("job_id = $1"), ["job-1", "token-1"]);
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a valid token that belongs to another resource", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    const next = vi.fn() as unknown as NextFunction;
    const res = createRes();

    await magicResourceAuth("repair")(createReq("repair-2", "token-from-repair-1"), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("magicAuth", () => {
  it("accepts a token from the magic-link path", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ id: "job-1" }] });
    const next = vi.fn() as unknown as NextFunction;
    const res = createRes();
    const req = {
      params: { token: "token-1" }, query: {}, headers: {}, body: {},
    } as unknown as Request;

    await magicAuth(req, res, next);

    expect(mocks.poolQuery).toHaveBeenCalledWith(expect.stringContaining("magic_link_token = $1"), ["token-1", "token-1"]);
    expect(next).toHaveBeenCalledOnce();
  });
});