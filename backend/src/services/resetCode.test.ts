import { describe, it, expect, vi, afterEach } from "vitest";
import { generateCode, hashCode, verifyCode, isCodeExpired, getCodeExpiry } from "./resetCode";

describe("resetCode", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("generateCode", () => {
    it("returns a 6-digit numeric string", () => {
      const code = generateCode();
      expect(code).toMatch(/^\d{6}$/);
    });

    it("returns a value within the OTP range", () => {
      const code = Number(generateCode());
      expect(code).toBeGreaterThanOrEqual(100000);
      expect(code).toBeLessThan(1000000);
    });

    it("produces distinct values over multiple calls", () => {
      const codes = new Set(Array.from({ length: 20 }, () => generateCode()));
      expect(codes.size).toBeGreaterThan(1);
    });
  });

  describe("hashCode / verifyCode", () => {
    it("round-trips a code through hash and verify", async () => {
      const hash = await hashCode("123456");
      expect(hash).toBeTruthy();
      expect(hash).not.toBe("123456");
      await expect(verifyCode("123456", hash)).resolves.toBe(true);
    });

    it("rejects a wrong code", async () => {
      const hash = await hashCode("123456");
      await expect(verifyCode("654321", hash)).resolves.toBe(false);
    });
  });

  describe("isCodeExpired", () => {
    it("returns false when expiry is in the future", () => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      expect(isCodeExpired(new Date("2026-01-01T00:05:00Z"))).toBe(false);
    });

    it("returns true when expiry is in the past", () => {
      vi.setSystemTime(new Date("2026-01-01T00:10:00Z"));
      expect(isCodeExpired(new Date("2026-01-01T00:05:00Z"))).toBe(true);
    });

    it("returns false at exactly the expiry moment (uses >)", () => {
      vi.setSystemTime(new Date("2026-01-01T00:05:00Z"));
      expect(isCodeExpired(new Date("2026-01-01T00:05:00Z"))).toBe(false);
    });
  });

  describe("getCodeExpiry", () => {
    it("returns a date 10 minutes from now", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const expiry = getCodeExpiry();
      expect(expiry.toISOString()).toBe("2026-01-01T00:10:00.000Z");
    });
  });
});