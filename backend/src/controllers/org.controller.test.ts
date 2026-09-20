import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock("../config/db", () => ({
  pool: { query: mocks.poolQuery },
}));
vi.mock("../services/sse", () => ({ broadcast: mocks.broadcast }));

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
      expect(mocks.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ORG_MEMBERS_CHANGED", orgId: "org-1" })
      );
    });
  });

  describe("getInfo", () => {
    it("should auto-generate an invite code for an admin org missing one", async () => {
      const req = {
        user: { userId: "u-1", orgId: "org-1", role: "ADMIN" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery
        .mockResolvedValueOnce({
          rows: [{ org_id: "org-1", name: "My Co", slug: "my-co", invite_code: null, created_at: "2026-01-01" }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await orgCtrl.getOrgInfo(req, res);

      const update = mocks.poolQuery.mock.calls.find((c) =>
        String(c[0]).includes("UPDATE organizations SET invite_code")
      );
      expect(update).toBeDefined();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ org_id: "org-1", invite_code: expect.stringMatching(/^[A-Z0-9]{8}$/) })
      );
    });
  });

  describe("rotateInviteCode", () => {
    it("should rotate the invite code", async () => {
      const req = {
        user: { userId: "u-1", orgId: "org-1", role: "ADMIN" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ invite_code: "NEWCODE1" }] });

      await orgCtrl.rotateInviteCode(req, res);

      const update = mocks.poolQuery.mock.calls.find((c) =>
        String(c[0]).includes("UPDATE organizations")
      );
      expect(update).toBeDefined();
      expect(update![1][1]).toBe("org-1");
      expect(update![1][0]).toMatch(/^[A-Z0-9]{8}$/);
      expect(res.json).toHaveBeenCalledWith({ invite_code: "NEWCODE1" });
      expect(mocks.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ORG_MEMBERS_CHANGED", orgId: "org-1" })
      );
    });

    it("should return 400 when the user has no org", async () => {
      const req = { user: { role: "ADMIN" } } as unknown as Request;
      const res = createRes();

      await orgCtrl.rotateInviteCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("updateInviteCode", () => {
    it("should reject an invalid custom code", async () => {
      const req = {
        user: { orgId: "org-1", role: "ADMIN" },
        body: { invite_code: "แค่ข้อความ!" },
      } as unknown as Request;
      const res = createRes();

      await orgCtrl.updateInviteCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should reject a code used by another org", async () => {
      const req = {
        user: { orgId: "org-1", role: "ADMIN" },
        body: { invite_code: "takencode" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({ rows: [{ org_id: "org-2" }] });

      await orgCtrl.updateInviteCode(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("ถูกใช้โดยองค์กรอื่น") })
      );
    });

    it("should save a custom invite code", async () => {
      const req = {
        user: { orgId: "org-1", role: "ADMIN" },
        body: { invite_code: "mycode123" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ invite_code: "MYCODE123" }] });

      await orgCtrl.updateInviteCode(req, res);

      expect(mocks.poolQuery).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE organizations"),
        ["MYCODE123", "org-1"]
      );
      expect(res.json).toHaveBeenCalledWith({ invite_code: "MYCODE123" });
      expect(mocks.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ORG_MEMBERS_CHANGED", orgId: "org-1" })
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
      expect(mocks.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "ORG_MEMBERS_CHANGED", orgId: "org-1" })
      );
    });
  });
});
