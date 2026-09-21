import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

import { api } from "./client";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, opts: Partial<{ status: number; ok: boolean }> = {}) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: vi.fn().mockResolvedValue(body),
    blob: vi.fn().mockResolvedValue(new Blob(["pdf"])),
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("does not attach an Authorization header without a token", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1 }]));
    const out = await api.get("/jobs");
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/jobs`,
      expect.objectContaining({
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
      })
    );
    expect(out).toEqual([{ id: 1 }]);
  });

  it("attaches the Bearer token from localStorage", async () => {
    localStorage.setItem("welldrill-token", "tok-123");
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.get("/jobs");
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/jobs`,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer tok-123" }),
      })
    );
  });

  it("POSTs JSON with method and body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 2 }));
    const body = { job_title: "งาน" };
    await api.post("/jobs", body);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/jobs`,
      expect.objectContaining({ method: "POST", body: JSON.stringify(body) })
    );
  });

  it("clears the session on 401", async () => {
    localStorage.setItem("welldrill-token", "expired");
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "unauth" }, { status: 401, ok: false }));

    await expect(api.get("/jobs")).rejects.toThrow("เซสชันหมดอายุ");
    expect(localStorage.getItem("welldrill-token")).toBeNull();
  });

  it("throws the server-provided error message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "ต้องระบุ customer_id" }, { status: 400, ok: false })
    );
    await expect(api.post("/wells", {})).rejects.toThrow("ต้องระบุ customer_id");
  });

  it("falls back to the HTTP status when the body has no error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: vi.fn().mockRejectedValue(new Error("no json")),
    } as unknown as Response);
    await expect(api.get("/nope")).rejects.toThrow("HTTP 500");
  });

  it("returns null for a 204 response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null, { status: 204 }));
    const out = await api.del("/jobs/1");
    expect(out).toBeNull();
  });

  it("bails out (returns null) for a 204 that carries no json", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: vi.fn().mockResolvedValue(""),
    } as unknown as Response);
    expect(await api.get("/empty")).toBeNull();
  });
});

describe("api.download", () => {
  it("downloads a blob and clicks a temp anchor", async () => {
    localStorage.setItem("welldrill-token", "tok");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: vi.fn().mockResolvedValue(new Blob(["pdf"])),
    } as unknown as Response);

    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL } as any);

    const anchor = { href: "", download: "", click: vi.fn() };
    const createElement = vi.spyOn(document, "createElement").mockReturnValue(anchor as any);

    await api.download("/wells/1/report.pdf", "report.pdf");

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(createElement).toHaveBeenCalledWith("a");
    expect(anchor.download).toBe("report.pdf");
    expect(anchor.click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake");
  });
});