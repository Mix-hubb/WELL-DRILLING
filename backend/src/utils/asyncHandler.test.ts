import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { asyncHandler } from "./asyncHandler";

describe("asyncHandler", () => {
  it("calls next with the error when the handler rejects", async () => {
    const err = new Error("boom");
    const handler = vi.fn().mockRejectedValue(err);
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    asyncHandler(handler)(req, res, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalled());
    expect(next).toHaveBeenCalledWith(err);
  });

  it("does not call next when the handler resolves", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    asyncHandler(handler)(req, res, next);
    await vi.waitFor(() => expect(handler).toHaveBeenCalled());
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards request, response and next to the handler", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    asyncHandler(handler)(req, res, next);
    await vi.waitFor(() => expect(handler).toHaveBeenCalledWith(req, res, next));
  });

  it("does not swallow synchronous throws from the handler", () => {
    const err = new Error("sync");
    const handler = vi.fn().mockImplementation(() => {
      throw err;
    });
    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    expect(() => asyncHandler(handler)(req, res, next)).toThrow("sync");
    expect(next).not.toHaveBeenCalled();
  });
});