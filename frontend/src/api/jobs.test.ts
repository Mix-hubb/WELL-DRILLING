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

import { jobsApi } from "./jobs";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("jobsApi", () => {
  it("list calls GET /jobs without status", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [{ id: 1 }] });
    const result = await jobsApi.list();
    expect(mockApi.get).toHaveBeenCalledWith("/jobs");
    expect(result).toEqual({ data: [{ id: 1 }] });
  });

  it("list calls GET /jobs?status=X when status provided", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });
    await jobsApi.list("DRILLING");
    expect(mockApi.get).toHaveBeenCalledWith("/jobs?status=DRILLING");
  });

  it("getOne calls GET /jobs/:id", async () => {
    mockApi.get.mockResolvedValueOnce({ data: { id: 3 } });
    const result = await jobsApi.getOne(3);
    expect(mockApi.get).toHaveBeenCalledWith("/jobs/3");
    expect(result).toEqual({ data: { id: 3 } });
  });

  it("getOne accepts string id", async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });
    await jobsApi.getOne("abc");
    expect(mockApi.get).toHaveBeenCalledWith("/jobs/abc");
  });

  it("create calls POST /jobs with data", async () => {
    const data = { job_title: "Test" };
    mockApi.post.mockResolvedValueOnce({ data: { id: 1, ...data } });
    const result = await jobsApi.create(data);
    expect(mockApi.post).toHaveBeenCalledWith("/jobs", data);
    expect(result).toEqual({ data: { id: 1, ...data } });
  });

  it("update calls PUT /jobs/:id with data", async () => {
    const data = { job_title: "Updated" };
    mockApi.put.mockResolvedValueOnce({ data: { id: 2, ...data } });
    const result = await jobsApi.update(2, data);
    expect(mockApi.put).toHaveBeenCalledWith("/jobs/2", data);
    expect(result).toEqual({ data: { id: 2, ...data } });
  });

  it("updateStatus calls PATCH /jobs/:id/status with status", async () => {
    mockApi.patch.mockResolvedValueOnce({ data: { job_id: 4, status: "SUCCESS" } });
    const result = await jobsApi.updateStatus(4, "SUCCESS");
    expect(mockApi.patch).toHaveBeenCalledWith("/jobs/4/status", { status: "SUCCESS" });
    expect(result).toEqual({ data: { job_id: 4, status: "SUCCESS" } });
  });

  it("generateMagicLink calls POST /jobs/:id/magic-link", async () => {
    mockApi.post.mockResolvedValueOnce({ data: { token: "tok123" } });
    const result = await jobsApi.generateMagicLink(6);
    expect(mockApi.post).toHaveBeenCalledWith("/jobs/6/magic-link", {});
    expect(result).toEqual({ data: { token: "tok123" } });
  });

  it("remove calls DELETE /jobs/:id", async () => {
    mockApi.del.mockResolvedValueOnce(null);
    const result = await jobsApi.remove(8);
    expect(mockApi.del).toHaveBeenCalledWith("/jobs/8");
    expect(result).toBeNull();
  });

  it("getByMagicToken calls GET /jobs/magic/:token", async () => {
    mockApi.get.mockResolvedValueOnce({ data: { id: 1 } });
    const result = await jobsApi.getByMagicToken("mytoken");
    expect(mockApi.get).toHaveBeenCalledWith("/jobs/magic/mytoken");
    expect(result).toEqual({ data: { id: 1 } });
  });

  it("completeWell calls PATCH /jobs/:id/well with data", async () => {
    const data = { depth: 100 };
    mockApi.patch.mockResolvedValueOnce({ data: { id: 5, ...data } });
    const result = await jobsApi.completeWell(5, data);
    expect(mockApi.patch).toHaveBeenCalledWith("/jobs/5/well", data);
    expect(result).toEqual({ data: { id: 5, ...data } });
  });
});
