import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApi = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ data: null }),
  post: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock("./client", () => ({
  api: mockApi,
}));

import { authApi } from "./auth";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("authApi", () => {
  it("login calls POST /auth/login with email and password", async () => {
    const payload = { email: "a@b.com", password: "secret" };
    mockApi.post.mockResolvedValueOnce({ data: { token: "t", user: {} } });
    const result = await authApi.login(payload.email, payload.password);
    expect(mockApi.post).toHaveBeenCalledWith("/auth/login", payload);
    expect(result).toEqual({ data: { token: "t", user: {} } });
  });

  it("register calls POST /auth/register with all fields", async () => {
    mockApi.post.mockResolvedValueOnce({ data: { token: "t", user: {} } });
    await authApi.register("x@y.com", "pw", "Name", "081", { org_name: "Org", invite_code: "INV" });
    expect(mockApi.post).toHaveBeenCalledWith("/auth/register", {
      email: "x@y.com",
      password: "pw",
      full_name: "Name",
      phone: "081",
      org_name: "Org",
      invite_code: "INV",
    });
  });

  it("register works without optional opts", async () => {
    mockApi.post.mockResolvedValueOnce({ data: { token: "t", user: {} } });
    await authApi.register("a@b.com", "pw", "Name", "081");
    expect(mockApi.post).toHaveBeenCalledWith("/auth/register", {
      email: "a@b.com",
      password: "pw",
      full_name: "Name",
      phone: "081",
    });
  });

  it("me calls GET /auth/me", async () => {
    mockApi.get.mockResolvedValueOnce({ data: { user_id: 1 } });
    const result = await authApi.me();
    expect(mockApi.get).toHaveBeenCalledWith("/auth/me");
    expect(result).toEqual({ data: { user_id: 1 } });
  });

  it("forgotPassword calls POST /auth/forgot-password with email and method", async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: "sent" } });
    await authApi.forgotPassword("a@b.com", "email");
    expect(mockApi.post).toHaveBeenCalledWith("/auth/forgot-password", {
      email: "a@b.com",
      method: "email",
    });
  });

  it("forgotPassword supports sms method", async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: "sent" } });
    await authApi.forgotPassword("a@b.com", "sms");
    expect(mockApi.post).toHaveBeenCalledWith("/auth/forgot-password", {
      email: "a@b.com",
      method: "sms",
    });
  });

  it("verifyCode calls POST /auth/verify-code with email and code", async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: "ok" } });
    await authApi.verifyCode("a@b.com", "123456");
    expect(mockApi.post).toHaveBeenCalledWith("/auth/verify-code", {
      email: "a@b.com",
      code: "123456",
    });
  });

  it("resetPassword calls POST /auth/reset-password with email, code, newPassword", async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: "reset" } });
    await authApi.resetPassword("a@b.com", "123456", "newpw");
    expect(mockApi.post).toHaveBeenCalledWith("/auth/reset-password", {
      email: "a@b.com",
      code: "123456",
      newPassword: "newpw",
    });
  });
});
