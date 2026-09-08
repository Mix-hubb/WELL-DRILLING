import { describe, it, expect, vi, beforeEach } from "vitest";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { signToken, verifyToken, authMiddleware, type AuthPayload } from "./auth";

const payload: AuthPayload = {
  userId: "u-1",
  email: "test@example.com",
  role: "ADMIN",
  orgId: "org-1",
};

function createRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn();
  return res;
}

describe("signToken / verifyToken", () => {
  it("signs and verifies a token round-trip", () => {
    const token = signToken(payload);
    expect(typeof token).toBe("string");
    const decoded = verifyToken(token);
    expect(decoded.userId).toBe("u-1");
    expect(decoded.email).toBe("test@example.com");
    expect(decoded.role).toBe("ADMIN");
    expect(decoded.orgId).toBe("org-1");
  });

  it("rejects a token signed with a different secret", () => {
    const forged = jwt.sign(payload, "other-secret");
    expect(() => verifyToken(forged)).toThrow();
  });

  it("rejects a garbage token", () => {
    expect(() => verifyToken("not-a-token")).toThrow();
  });
});

describe("authMiddleware", () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn() as unknown as NextFunction;
  });

  it("returns 401 when authorization header is missing", () => {
    const req = { headers: {} } as Request;
    const res = createRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "ไม่ได้เข้าสู่ระบบ" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when header does not start with Bearer", () => {
    const req = { headers: { authorization: "Basic abc" } } as unknown as Request;
    const res = createRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalid token", () => {
    const req = { headers: { authorization: "Bearer invalid-token" } } as unknown as Request;
    const res = createRes();
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });
    expect(next).not.toHaveBeenCalled();
  });

  it("sets req.user and calls next for a valid token", () => {
    const token = signToken(payload);
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const res = createRes();
    authMiddleware(req, res, next);
    expect(req.user).toMatchObject({ userId: "u-1", email: "test@example.com" });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});