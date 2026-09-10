import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApi = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ data: null }),
  post: vi.fn().mockResolvedValue({ data: null }),
  put: vi.fn().mockResolvedValue({ data: null }),
  patch: vi.fn().mockResolvedValue({ data: null }),
  del: vi.fn().mockResolvedValue(null),
}));

vi.mock("./client", () => ({
  api: mockApi,
}));

import { drillingRequestsApi } from "./drillingRequests";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("drillingRequestsApi", () => {
  it("list calls GET /drilling-requests", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [{ id: 1 }] });
    const result = await drillingRequestsApi.list();
    expect(mockApi.get).toHaveBeenCalledWith("/drilling-requests");
    expect(result).toEqual({ data: [{ id: 1 }] });
  });

  it("create calls POST /drilling-requests with data", async () => {
    const data = { customer_id: 1 };
    mockApi.post.mockResolvedValueOnce({ data: { id: 10, ...data } });
    const result = await drillingRequestsApi.create(data);
    expect(mockApi.post).toHaveBeenCalledWith("/drilling-requests", data);
    expect(result).toEqual({ data: { id: 10, ...data } });
  });

  it("update calls PUT /drilling-requests/:id with data", async () => {
    const data = { notes: "updated" };
    mockApi.put.mockResolvedValueOnce({ data: { request_id: 5, ...data } });
    const result = await drillingRequestsApi.update(5, data);
    expect(mockApi.put).toHaveBeenCalledWith("/drilling-requests/5", data);
    expect(result).toEqual({ data: { request_id: 5, ...data } });
  });

  it("update accepts string id", async () => {
    mockApi.put.mockResolvedValueOnce({ data: { request_id: "abc" } });
    await drillingRequestsApi.update("abc", { notes: "x" });
    expect(mockApi.put).toHaveBeenCalledWith("/drilling-requests/abc", { notes: "x" });
  });

  it("updateStatus calls PATCH /drilling-requests/:id/status with status", async () => {
    mockApi.patch.mockResolvedValueOnce({ data: { request_id: 5, status: "ACCEPTED" } });
    const result = await drillingRequestsApi.updateStatus(5, "ACCEPTED");
    expect(mockApi.patch).toHaveBeenCalledWith("/drilling-requests/5/status", { status: "ACCEPTED" });
    expect(result).toEqual({ data: { request_id: 5, status: "ACCEPTED" } });
  });

  it("updateStatus accepts string id", async () => {
    mockApi.patch.mockResolvedValueOnce({ data: {} });
    await drillingRequestsApi.updateStatus("xyz", "REJECTED");
    expect(mockApi.patch).toHaveBeenCalledWith("/drilling-requests/xyz/status", { status: "REJECTED" });
  });

  it("remove calls DELETE /drilling-requests/:id", async () => {
    mockApi.del.mockResolvedValueOnce(null);
    const result = await drillingRequestsApi.remove(9);
    expect(mockApi.del).toHaveBeenCalledWith("/drilling-requests/9");
    expect(result).toBeNull();
  });

  it("remove accepts string id", async () => {
    mockApi.del.mockResolvedValueOnce(null);
    await drillingRequestsApi.remove("abc");
    expect(mockApi.del).toHaveBeenCalledWith("/drilling-requests/abc");
  });
});
