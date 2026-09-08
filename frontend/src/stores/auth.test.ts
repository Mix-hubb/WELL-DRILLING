import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { AuthResponse } from "@/api/auth";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  me: vi.fn(),
}));

vi.mock("@/api/auth", () => ({
  authApi: { login: mocks.login, register: mocks.register, me: mocks.me },
}));

import { useAuthStore } from "./auth";

const meUser = { user_id: 1, email: "a@b.co", full_name: "สมชาย", role: "ADMIN" as const };

beforeEach(() => {
  localStorage.clear();
  setActivePinia(createPinia());
  mocks.login.mockReset();
  mocks.register.mockReset();
  mocks.me.mockReset();
});

describe("auth store", () => {
  it("initializes token from localStorage", () => {
    localStorage.setItem("welldrill-token", "pre-token");
    setActivePinia(createPinia());
    const store = useAuthStore();
    expect(store.token).toBe("pre-token");
    expect(store.isLoggedIn).toBe(true);
  });

  it("isLoggedIn is false when logged out", () => {
    const store = useAuthStore();
    expect(store.isLoggedIn).toBe(false);
  });

  it("setToken persists the token to localStorage", () => {
    const store = useAuthStore();
    store.setToken("tok-1");
    expect(store.token).toBe("tok-1");
    expect(localStorage.getItem("welldrill-token")).toBe("tok-1");
  });

  it("clearAuth wipes token and user", () => {
    localStorage.setItem("welldrill-token", "tok-1");
    const store = useAuthStore();
    store.user = meUser;
    store.clearAuth();
    expect(store.token).toBe("");
    expect(store.user).toBeNull();
    expect(localStorage.getItem("welldrill-token")).toBeNull();
  });

  it("fullName returns the user's name or empty", () => {
    const store = useAuthStore();
    expect(store.fullName).toBe("");
    store.user = meUser;
    expect(store.fullName).toBe("สมชาย");
  });

  it("login stores token + user", async () => {
    const res: AuthResponse = { token: "jwt", user: meUser };
    mocks.login.mockResolvedValueOnce(res);
    const store = useAuthStore();
    const out = await store.login("a@b.co", "secret");
    expect(mocks.login).toHaveBeenCalledWith("a@b.co", "secret");
    expect(out).toEqual(res);
    expect(store.token).toBe("jwt");
    expect(store.user).toEqual(meUser);
    expect(localStorage.getItem("welldrill-token")).toBe("jwt");
  });

  it("register stores token + user", async () => {
    const res: AuthResponse = { token: "jwt2", user: meUser };
    mocks.register.mockResolvedValueOnce(res);
    const store = useAuthStore();
    await store.register("a@b.co", "secret", "สมชาย", "0812345678", { org_name: "Co" });
    expect(mocks.register).toHaveBeenCalledWith("a@b.co", "secret", "สมชาย", "0812345678", { org_name: "Co" });
    expect(store.token).toBe("jwt2");
  });

  it("fetchUser loads the profile when a token exists", async () => {
    localStorage.setItem("welldrill-token", "tok");
    setActivePinia(createPinia());
    const store = useAuthStore();
    mocks.me.mockResolvedValueOnce(meUser);
    await store.fetchUser();
    expect(store.user).toEqual(meUser);
  });

  it("fetchUser clears auth on failure", async () => {
    localStorage.setItem("welldrill-token", "tok");
    setActivePinia(createPinia());
    const store = useAuthStore();
    mocks.me.mockRejectedValueOnce(new Error("401"));
    await store.fetchUser();
    expect(store.token).toBe("");
    expect(store.user).toBeNull();
  });

  it("fetchUser does nothing without a token", async () => {
    const store = useAuthStore();
    await store.fetchUser();
    expect(mocks.me).not.toHaveBeenCalled();
  });

  it("logout clears the session", async () => {
    localStorage.setItem("welldrill-token", "tok");
    setActivePinia(createPinia());
    const store = useAuthStore();
    store.logout();
    expect(store.token).toBe("");
  });
});