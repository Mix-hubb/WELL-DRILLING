import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock("../config/db", () => ({
  pool: { query: mocks.poolQuery },
}));
vi.mock("../services/sse", () => ({
  broadcast: mocks.broadcast,
}));

import * as repairRecords from "./repairRecords.controller";

function createRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn();
  return res as Response & { statusCode: number; json: any; status: any; end: any };
}

describe("repairRecords.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("update", () => {
    it("should return 404 if record does not exist or unauthorized", async () => {
      const req = {
        params: { id: "99" },
        body: { work_details: "เปลี่ยนซีล" },
        user: { userId: "u-1", role: "ADMIN", orgId: "org-1" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

      await repairRecords.update(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should update repair record successfully and broadcast event", async () => {
      const req = {
        params: { id: "10" },
        body: {
          work_details: "เปลี่ยนปั๊มใหม่",
          final_price: 15000,
          is_warranty_claim: false,
          parts: [{ name: "วาล์ว", qty: 1, unit_price: 500 }],
        },
        user: { userId: "u-1", role: "ADMIN", orgId: "org-1" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({
        rows: [{ record_id: 10, repair_id: 5 }],
      });
      mocks.poolQuery.mockResolvedValueOnce({
        rows: [
          {
            record_id: 10,
            repair_id: 5,
            work_details: "เปลี่ยนปั๊มใหม่",
            final_price: "15000",
            parts: JSON.stringify([{ name: "วาล์ว", qty: 1, unit_price: 500 }]),
            pump: null,
            is_warranty_claim: false,
            completed_at: "2026-03-01T00:00:00Z",
            created_at: "2026-03-01T00:00:00Z",
          },
        ],
      });

      await repairRecords.update(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          record_id: 10,
          work_details: "เปลี่ยนปั๊มใหม่",
          final_price: "15000",
        })
      );
      expect(mocks.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "REPAIR_RECORD_UPDATED",
          data: { record_id: "10", repair_id: 5 },
          orgId: "org-1",
        })
      );
    });
  });

  describe("remove", () => {
    it("should return 404 if record does not exist or unauthorized", async () => {
      const req = {
        params: { id: "99" },
        user: { userId: "u-1", role: "ADMIN", orgId: "org-1" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

      await repairRecords.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("deletes the record and broadcasts with repair_id so the detail page can filter correctly", async () => {
      const req = {
        params: { id: "10" },
        user: { userId: "u-1", role: "ADMIN", orgId: "org-1" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({ rows: [{ record_id: "10", repair_id: 5 }] });
      mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

      await repairRecords.remove(req, res);

      expect(mocks.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "REPAIR_RECORD_DELETED",
          data: { record_id: "10", repair_id: 5 },
          orgId: "org-1",
        })
      );
      expect(res.status).toHaveBeenCalledWith(204);
    });
  });
});
