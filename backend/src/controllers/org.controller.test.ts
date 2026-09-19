import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
}));

vi.mock("../config/db", () => ({
  pool: { query: mocks.poolQuery },
}));

import * as orgCtrl from "./org.controller";

function createRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn();
  return res as Response & { statusCode: number; json: any; status: any; end: any };
}

describe("org.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getMembers", () => {
    it("should return members for the user's organization", async () => {
      const req = {
        user: { userId: "u-1", orgId: "org-1", role: "ADMIN" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({
        rows: [
          { user_id: "u-1", full_name: "Admin User", role: "ADMIN" },
          { user_id: "u-2", full_name: "Driller User", role: "DRILLER" },
        ],
      });

      await orgCtrl.getMembers(req, res);

      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({ user_id: "u-1" }),
        expect.objectContaining({ user_id: "u-2" }),
      ]);
    });
  });

  describe("updateMemberRole", () => {
    it("should reject non-admin users", async () => {
      const req = {
        user: { userId: "u-2", orgId: "org-1", role: "DRILLER" },
        params: { id: "u-1" },
        body: { role: "DRILLER" },
      } as unknown as Request;
      const res = createRes();

      await orgCtrl.updateMemberRole(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("should reject invalid role", async () => {
      const req = {
        user: { userId: "u-1", orgId: "org-1", role: "ADMIN" },
        params: { id: "u-2" },
        body: { role: "SUPERMAN" },
      } as unknown as Request;
      const res = createRes();

      await orgCtrl.updateMemberRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should prevent demoting last admin", async () => {
      const req = {
        user: { userId: "u-1", orgId: "org-1", role: "ADMIN" },
        params: { id: "u-1" },
        body: { role: "DRILLER" },
      } as unknown as Request;
      const res = createRes();

      // target user is ADMIN
      mocks.poolQuery.mockResolvedValueOnce({
        rows: [{ user_id: "u-1", role: "ADMIN" }],
      });
      // admin count is 1
      mocks.poolQuery.mockResolvedValueOnce({
        rows: [{ count: "1" }],
      });

      await orgCtrl.updateMemberRole(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should update role successfully", async () => {
      const req = {
        user: { userId: "u-1", orgId: "org-1", role: "ADMIN" },
        params: { id: "u-2" },
        body: { role: "ADMIN" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({
        rows: [{ user_id: "u-2", role: "DRILLER" }],
      });
      mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

      await orgCtrl.updateMemberRole(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: "อัปเดตบทบาทสำเร็จ", role: "ADMIN" })
      );
    });
  });

  describe("removeMember", () => {
    it("should prevent admin from removing themselves", async () => {
      const req = {
        user: { userId: "u-1", orgId: "org-1", role: "ADMIN" },
        params: { id: "u-1" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({
        rows: [{ user_id: "u-1", role: "ADMIN" }],
      });

      await orgCtrl.removeMember(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should remove member successfully and return 204", async () => {
      const req = {
        user: { userId: "u-1", orgId: "org-1", role: "ADMIN" },
        params: { id: "u-2" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({
        rows: [{ user_id: "u-2", role: "DRILLER" }],
      });
      mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

      await orgCtrl.removeMember(req, res);

      expect(res.status).toHaveBeenCalledWith(204);
    });
  });
});
