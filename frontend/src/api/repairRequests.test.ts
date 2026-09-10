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

import { repairRequestsApi } from "./repairRequests";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("repairRequestsApi", () => {
  it("list calls GET /repair-requests", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [{ id: 1 }] });
    const result = await repairRequestsApi.list();
    expect(mockApi.get).toHaveBeenCalledWith("/repair-requests");
    expect(result).toEqual({ data: [{ id: 1 }] });
  });

  it("getOne calls GET /repair-requests/:id", async () => {
    mockApi.get.mockResolvedValueOnce({ data: { id: 4 } });
    const result = await repairRequestsApi.getOne(4);
    expect(mockApi.get).toHaveBeenCalledWith("/repair-requests/4");
    expect(result).toEqual({ data: { id: 4 } });
  });

  it("getOne accepts string id", async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });
    await repairRequestsApi.getOne("abc");
    expect(mockApi.get).toHaveBeenCalledWith("/repair-requests/abc");
  });

  it("create calls POST /repair-requests with data", async () => {
    const data = { customer_id: 1, issue: "broken pump" };
    mockApi.post.mockResolvedValueOnce({ data: { id: 10, ...data } });
    const result = await repairRequestsApi.create(data);
    expect(mockApi.post).toHaveBeenCalledWith("/repair-requests", data);
    expect(result).toEqual({ data: { id: 10, ...data } });
  });

  it("update calls PUT /repair-requests/:id with data", async () => {
    const data = { detail: "updated" };
    mockApi.put.mockResolvedValueOnce({ data: { repair_id: 5, ...data } });
    const result = await repairRequestsApi.update(5, data);
    expect(mockApi.put).toHaveBeenCalledWith("/repair-requests/5", data);
    expect(result).toEqual({ data: { repair_id: 5, ...data } });
  });

  it("updateStatus calls PATCH /repair-requests/:id/status with status", async () => {
    mockApi.patch.mockResolvedValueOnce({ data: { repair_id: 5, status: "IN_PROGRESS" } });
    const result = await repairRequestsApi.updateStatus(5, "IN_PROGRESS");
    expect(mockApi.patch).toHaveBeenCalledWith("/repair-requests/5/status", { status: "IN_PROGRESS" });
    expect(result).toEqual({ data: { repair_id: 5, status: "IN_PROGRESS" } });
  });

  it("generateMagicLink calls POST /repair-requests/:id/magic-link", async () => {
    mockApi.post.mockResolvedValueOnce({ data: { token: "rptok" } });
    const result = await repairRequestsApi.generateMagicLink(7);
    expect(mockApi.post).toHaveBeenCalledWith("/repair-requests/7/magic-link", {});
    expect(result).toEqual({ data: { token: "rptok" } });
  });

  it("remove calls DELETE /repair-requests/:id", async () => {
    mockApi.del.mockResolvedValueOnce(null);
    const result = await repairRequestsApi.remove(9);
    expect(mockApi.del).toHaveBeenCalledWith("/repair-requests/9");
    expect(result).toBeNull();
  });

  it("getByMagicToken calls GET /repair-requests/magic/:token", async () => {
    mockApi.get.mockResolvedValueOnce({ data: { id: 1 } });
    const result = await repairRequestsApi.getByMagicToken("mytoken");
    expect(mockApi.get).toHaveBeenCalledWith("/repair-requests/magic/mytoken");
    expect(result).toEqual({ data: { id: 1 } });
  });

  it("addRecord calls POST /repair-requests/:id/records with data", async () => {
    const data = { description: "replaced seal" };
    mockApi.post.mockResolvedValueOnce({ data: { id: 3, records: [data] } });
    const result = await repairRequestsApi.addRecord(3, data);
    expect(mockApi.post).toHaveBeenCalledWith("/repair-requests/3/records", data);
    expect(result).toEqual({ data: { id: 3, records: [data] } });
  });
});
