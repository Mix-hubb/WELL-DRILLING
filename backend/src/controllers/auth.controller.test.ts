import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  poolConnect: vi.fn(),
  signToken: vi.fn(),
  bcryptHash: vi.fn(),
  bcryptCompare: vi.fn(),
  generateCode: vi.fn(),
  hashCode: vi.fn(),
  verifyCode: vi.fn(),
  getCodeExpiry: vi.fn(),
  isCodeExpired: vi.fn(),
  sendResetCodeEmail: vi.fn(),
  sendResetCodeSms: vi.fn(),
  consoleError: vi.spyOn(console, "error").mockImplementation(() => {}),
}));

const client = { query: vi.fn(), release: vi.fn() };

vi.mock("../config/db", () => ({
  pool: { query: mocks.poolQuery, connect: mocks.poolConnect },
}));
vi.mock("../middleware/auth", () => ({ signToken: mocks.signToken }));
vi.mock("bcryptjs", () => ({
  default: { hash: mocks.bcryptHash, compare: mocks.bcryptCompare },
}));
vi.mock("../services/resetCode", () => ({
  generateCode: mocks.generateCode,
  hashCode: mocks.hashCode,
  verifyCode: mocks.verifyCode,
  getCodeExpiry: mocks.getCodeExpiry,
  isCodeExpired: mocks.isCodeExpired,
}));
vi.mock("../services/email", () => ({ sendResetCodeEmail: mocks.sendResetCodeEmail }));
vi.mock("../services/sms", () => ({ sendResetCodeSms: mocks.sendResetCodeSms }));

import * as auth from "./auth.controller";

function createRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn();
  return res;
}

function createReq(body: Record<string, any> = {}, user?: any): Request {
  return { body, params: {}, query: {}, user } as unknown as Request;
}

beforeEach(() => {
  mocks.poolQuery.mockReset();
  mocks.poolConnect.mockReset();
  mocks.poolConnect.mockResolvedValue(client);
  mocks.signToken.mockReset();
  mocks.bcryptHash.mockReset();
  mocks.bcryptCompare.mockReset();
  mocks.generateCode.mockReset();
  mocks.hashCode.mockReset();
  mocks.verifyCode.mockReset();
  mocks.getCodeExpiry.mockReset();
  mocks.isCodeExpired.mockReset();
  mocks.sendResetCodeEmail.mockReset();
  mocks.sendResetCodeSms.mockReset();

  client.query.mockReset();
  client.query.mockImplementation(async (sql: string) => {
    if (sql.includes("INSERT INTO organizations")) return { rows: [{ org_id: "org-1" }] };
    if (sql.includes("INSERT INTO users")) return { rows: [{ user_id: "u-1" }] };
    return { rows: [] };
  });
  client.release.mockImplementation(() => undefined);
});

const validBody = {
  email: "user@example.com",
  password: "secret123",
  full_name: "สมชาย ใจดี",
  phone: "081-234-5678",
  org_name: "My Company",
};

describe("register", () => {
  it("returns 400 when required fields are missing", async () => {
    const res = createRes();
    await auth.register(createReq({}), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it("returns 400 for a malformed email", async () => {
    const res = createRes();
    await auth.register(createReq({ ...validBody, email: "not-an-email" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for an invalid phone", async () => {
    const res = createRes();
    await auth.register(createReq({ ...validBody, phone: "abc" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("accepts a phone with dashes and spaces", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    mocks.bcryptHash.mockResolvedValueOnce("hash");
    mocks.signToken.mockReturnValueOnce("token");
    const res = createRes();
    await auth.register(createReq({ ...validBody, phone: "081 234-5678" }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    const inserted = client.query.mock.calls.find((c) => String(c[0]).includes("INSERT INTO users"));
    expect(inserted![1][3]).toBe("0812345678");
  });

  it("returns 400 for a short password", async () => {
    const res = createRes();
    await auth.register(createReq({ ...validBody, password: "123" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 409 when the email is already registered", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ user_id: "existing" }] });
    const res = createRes();
    await auth.register(createReq(validBody), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "อีเมลนี้ถูกใช้แล้ว" });
  });

  it("returns 400 for an invalid invite code", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    client.query.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT org_id FROM organizations")) return { rows: [] };
      return { rows: [] };
    });
    const res = createRes();
    await auth.register(createReq({ ...validBody, invite_code: "bad-code" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invite code ไม่ถูกต้อง" });
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
  });

  it("returns 400 when joining an org but no org_name supplied", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await auth.register(createReq({ ...validBody, org_name: undefined }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "ต้องระบุ org_name สำหรับสร้างบริษัทใหม่" });
  });

  it("returns 201 and creates a new organization + user", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    mocks.bcryptHash.mockResolvedValueOnce("hash");
    mocks.signToken.mockReturnValueOnce("token");
    const res = createRes();
    await auth.register(createReq(validBody), res);

    expect(mocks.poolConnect).toHaveBeenCalled();
    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO organizations"),
      ["My Company", "my-company"]
    );
    expect(mocks.bcryptHash).toHaveBeenCalledWith("secret123", 10);
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "token",
        user: expect.objectContaining({ user_id: "u-1", email: "user@example.com" }),
      })
    );
  });

  it("throws and rolls back when the transaction fails", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    client.query.mockImplementationOnce(async () => undefined);
    client.query.mockImplementationOnce(async () => {
      throw new Error("db down");
    });
    const res = createRes();
    await expect(auth.register(createReq(validBody), res)).rejects.toThrow("db down");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });
});

describe("login", () => {
  it("returns 400 when email or password is missing", async () => {
    const res = createRes();
    await auth.login(createReq({ email: "only" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for a malformed email", async () => {
    const res = createRes();
    await auth.login(createReq({ email: "nope", password: "x" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 401 when no user matches the email", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await auth.login(createReq({ email: "user@example.com", password: "secret" }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 401 when the password is wrong", async () => {
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ user_id: "u1", email: "user@example.com", password_hash: "h", role: "DRILLER" }],
    });
    mocks.bcryptCompare.mockResolvedValueOnce(false);
    const res = createRes();
    await auth.login(createReq({ email: "user@example.com", password: "wrong" }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns token and user on success", async () => {
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ user_id: "u1", email: "user@example.com", password_hash: "h", full_name: "สมชาย", role: "DRILLER", org_id: "org-1" }],
    });
    mocks.bcryptCompare.mockResolvedValueOnce(true);
    mocks.signToken.mockReturnValueOnce("token-1");
    const res = createRes();
    await auth.login(createReq({ email: "user@example.com", password: "secret" }), res);
    expect(mocks.bcryptCompare).toHaveBeenCalledWith("secret", "h");
    expect(mocks.signToken).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", email: "user@example.com", orgId: "org-1" })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ token: "token-1", user: expect.objectContaining({ user_id: "u1" }) })
    );
  });
});

describe("me", () => {
  it("returns 404 when the user is not found", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await auth.me(createReq({}, { userId: "u1" }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the joined user + org data", async () => {
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ user_id: "u1", email: "user@example.com", org_name: "My Co", line_configured: false }],
    });
    const res = createRes();
    await auth.me(createReq({}, { userId: "u1" }), res);
    expect(mocks.poolQuery).toHaveBeenCalledWith(expect.stringContaining("FROM users u"), ["u1"]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ user_id: "u1" }));
  });
});

describe("forgotPassword", () => {
  it("returns 400 for an invalid email", async () => {
    const res = createRes();
    await auth.forgotPassword(createReq({ email: "bad", method: "email" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for an unsupported method", async () => {
    const res = createRes();
    await auth.forgotPassword(createReq({ email: "user@example.com", method: "fax" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("does not leak whether the email exists", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await auth.forgotPassword(createReq({ email: "ghost@example.com", method: "email" }), res);
    expect(res.json).toHaveBeenCalledWith({ message: "หากอีเมลนี้มีในระบบ จะได้รับรหัสยืนยันเร็วๆ นี้" });
    expect(mocks.sendResetCodeEmail).not.toHaveBeenCalled();
  });

  it("sends the code by email", async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ user_id: "u1", phone: "0812345678" }] })
      .mockResolvedValueOnce({ rows: [] });
    mocks.generateCode.mockReturnValueOnce("123456");
    mocks.hashCode.mockResolvedValueOnce("code-hash");
    mocks.getCodeExpiry.mockReturnValueOnce(new Date("2026-01-01T00:10:00Z"));
    mocks.sendResetCodeEmail.mockResolvedValueOnce(undefined);

    const res = createRes();
    await auth.forgotPassword(createReq({ email: "user@example.com", method: "email" }), res);

    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users SET reset_code"),
      ["code-hash", new Date("2026-01-01T00:10:00Z"), "email", "u1"]
    );
    expect(mocks.sendResetCodeEmail).toHaveBeenCalledWith("user@example.com", "123456");
    expect(res.json).toHaveBeenCalledWith({ message: "ส่งรหัสยืนยันเรียบร้อยแล้ว" });
  });

  it("sends the code by sms when the user has a phone", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ user_id: "u1", phone: "0812345678" }] });
    mocks.generateCode.mockReturnValueOnce("123456");
    mocks.hashCode.mockResolvedValueOnce("code-hash");
    mocks.getCodeExpiry.mockReturnValueOnce(new Date());
    mocks.sendResetCodeSms.mockResolvedValueOnce(undefined);

    const res = createRes();
    await auth.forgotPassword(createReq({ email: "user@example.com", method: "sms" }), res);
    expect(mocks.sendResetCodeSms).toHaveBeenCalledWith("0812345678", "123456");
    expect(res.json).toHaveBeenCalled();
  });

  it("returns 400 for sms when the user has no phone", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ user_id: "u1", phone: null }] });
    const res = createRes();
    await auth.forgotPassword(createReq({ email: "user@example.com", method: "sms" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("เบอร์โทรศัท์") })
    );
  });

  it("returns 500 when sending the code fails", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ user_id: "u1", phone: "0812345678" }] });
    mocks.generateCode.mockReturnValueOnce("123456");
    mocks.hashCode.mockResolvedValueOnce("code-hash");
    mocks.getCodeExpiry.mockReturnValueOnce(new Date());
    mocks.sendResetCodeEmail.mockRejectedValueOnce(new Error("smtp down"));

    const res = createRes();
    await auth.forgotPassword(createReq({ email: "user@example.com", method: "email" }), res);
    expect(mocks.consoleError).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("verifyCodeHandler", () => {
  it("returns 400 when email or code is missing", async () => {
    const res = createRes();
    await auth.verifyCodeHandler(createReq({ email: "only" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when there is no pending reset request", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await auth.verifyCodeHandler(createReq({ email: "user@example.com", code: "123456" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when the code has expired", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ reset_code: "hash", reset_expires: "2026-01-01" }] });
    mocks.isCodeExpired.mockReturnValueOnce(true);
    const res = createRes();
    await auth.verifyCodeHandler(createReq({ email: "user@example.com", code: "123456" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่" });
  });

  it("returns 400 when the code does not match", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ reset_code: "hash", reset_expires: "2026-01-01" }] });
    mocks.isCodeExpired.mockReturnValueOnce(false);
    mocks.verifyCode.mockResolvedValueOnce(false);
    const res = createRes();
    await auth.verifyCodeHandler(createReq({ email: "user@example.com", code: "000000" }), res);
    expect(mocks.verifyCode).toHaveBeenCalledWith("000000", "hash");
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns success for a valid code", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ reset_code: "hash", reset_expires: "2026-01-01" }] });
    mocks.isCodeExpired.mockReturnValueOnce(false);
    mocks.verifyCode.mockResolvedValueOnce(true);
    const res = createRes();
    await auth.verifyCodeHandler(createReq({ email: "user@example.com", code: "123456" }), res);
    expect(res.json).toHaveBeenCalledWith({ message: "รหัสยืนยันถูกต้อง" });
  });
});

describe("resetPassword", () => {
  it("returns 400 when fields are missing", async () => {
    const res = createRes();
    await auth.resetPassword(createReq({ email: "user@example.com" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for a short new password", async () => {
    const res = createRes();
    await auth.resetPassword(createReq({ email: "user@example.com", code: "123456", newPassword: "123" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when there is no pending reset request", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [] });
    const res = createRes();
    await auth.resetPassword(createReq({ email: "user@example.com", code: "123456", newPassword: "newpass123" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "ไม่พบคำขอรีเซ็ตรหัสผ่าน" });
  });

  it("returns 400 when the code has expired", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ user_id: "u1", reset_code: "hash", reset_expires: "2026-01-01" }] });
    mocks.isCodeExpired.mockReturnValueOnce(true);
    const res = createRes();
    await auth.resetPassword(createReq({ email: "user@example.com", code: "123456", newPassword: "newpass123" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 when the code does not match", async () => {
    mocks.poolQuery.mockResolvedValueOnce({ rows: [{ user_id: "u1", reset_code: "hash", reset_expires: "2026-01-01" }] });
    mocks.isCodeExpired.mockReturnValueOnce(false);
    mocks.verifyCode.mockResolvedValueOnce(false);
    const res = createRes();
    await auth.resetPassword(createReq({ email: "user@example.com", code: "123456", newPassword: "newpass123" }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("updates the password and clears the reset code on success", async () => {
    mocks.poolQuery
      .mockResolvedValueOnce({ rows: [{ user_id: "u1", reset_code: "hash", reset_expires: "2026-01-01" }] })
      .mockResolvedValueOnce({ rows: [] });
    mocks.isCodeExpired.mockReturnValueOnce(false);
    mocks.verifyCode.mockResolvedValueOnce(true);
    mocks.bcryptHash.mockResolvedValueOnce("new-hash");

    const res = createRes();
    await auth.resetPassword(createReq({ email: "user@example.com", code: "123456", newPassword: "newpass123" }), res);

    expect(mocks.bcryptHash).toHaveBeenCalledWith("newpass123", 10);
    expect(mocks.poolQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users SET password_hash"),
      expect.arrayContaining(["new-hash", "u1"])
    );
    expect(res.json).toHaveBeenCalledWith({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
  });
});