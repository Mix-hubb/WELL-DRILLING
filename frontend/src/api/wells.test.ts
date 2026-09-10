import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApi = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ data: null }),
  post: vi.fn().mockResolvedValue({ data: null }),
  del: vi.fn().mockResolvedValue(null),
}));

vi.mock("./client", () => ({
  api: mockApi,
}));

import { wellsApi } from "./wells";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("wellsApi", () => {
  it("list calls GET /wells", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [{ id: 1 }] });
    const result = await wellsApi.list();
    expect(mockApi.get).toHaveBeenCalledWith("/wells");
    expect(result).toEqual({ data: [{ id: 1 }] });
  });

  it("getOne calls GET /wells/:id", async () => {
    mockApi.get.mockResolvedValueOnce({ data: { id: 3 } });
    const result = await wellsApi.getOne(3);
    expect(mockApi.get).toHaveBeenCalledWith("/wells/3");
    expect(result).toEqual({ data: { id: 3 } });
  });

  it("getOne accepts string id", async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });
    await wellsApi.getOne("abc");
    expect(mockApi.get).toHaveBeenCalledWith("/wells/abc");
  });

  it("getByJob calls GET /wells/by-job/:jobId", async () => {
    mockApi.get.mockResolvedValueOnce({ data: { id: 2 } });
    const result = await wellsApi.getByJob(10);
    expect(mockApi.get).toHaveBeenCalledWith("/wells/by-job/10");
    expect(result).toEqual({ data: { id: 2 } });
  });

  it("getByJob accepts string jobId", async () => {
    mockApi.get.mockResolvedValueOnce({ data: {} });
    await wellsApi.getByJob("xyz");
    expect(mockApi.get).toHaveBeenCalledWith("/wells/by-job/xyz");
  });

  it("create calls POST /wells with data", async () => {
    const data = { customer_id: 1, depth: 50 };
    mockApi.post.mockResolvedValueOnce({ data: { id: 5, ...data } });
    const result = await wellsApi.create(data);
    expect(mockApi.post).toHaveBeenCalledWith("/wells", data);
    expect(result).toEqual({ data: { id: 5, ...data } });
  });

  it("addStrata calls POST /wells/:wellId/strata with data", async () => {
    const data = { depth_from_m: 0, depth_to_m: 10, lithology_type: "SAND" as const };
    mockApi.post.mockResolvedValueOnce({ data: { strata_id: 1 } });
    const result = await wellsApi.addStrata(3, data);
    expect(mockApi.post).toHaveBeenCalledWith("/wells/3/strata", data);
    expect(result).toEqual({ data: { strata_id: 1 } });
  });

  it("removeStrata calls DELETE /wells/:wellId/strata/:strataId", async () => {
    mockApi.del.mockResolvedValueOnce(null);
    const result = await wellsApi.removeStrata(3, 7);
    expect(mockApi.del).toHaveBeenCalledWith("/wells/3/strata/7");
    expect(result).toBeNull();
  });

  it("addPipe calls POST /wells/:wellId/pipes with data", async () => {
    const data = { size_mm: 4, depth_from_m: 0, depth_to_m: 12 };
    mockApi.post.mockResolvedValueOnce({ data: { pipe_id: 2 } });
    const result = await wellsApi.addPipe(5, data);
    expect(mockApi.post).toHaveBeenCalledWith("/wells/5/pipes", data);
    expect(result).toEqual({ data: { pipe_id: 2 } });
  });

  it("removePipe calls DELETE /wells/:wellId/pipes/:pipeId", async () => {
    mockApi.del.mockResolvedValueOnce(null);
    const result = await wellsApi.removePipe(5, 8);
    expect(mockApi.del).toHaveBeenCalledWith("/wells/5/pipes/8");
    expect(result).toBeNull();
  });

  it("addPump calls POST /wells/:wellId/pumps with data", async () => {
    const data = { pump_model: "P100", horsepower: 5 };
    mockApi.post.mockResolvedValueOnce({ data: { pump_id: 3 } });
    const result = await wellsApi.addPump(6, data);
    expect(mockApi.post).toHaveBeenCalledWith("/wells/6/pumps", data);
    expect(result).toEqual({ data: { pump_id: 3 } });
  });

  it("removePump calls DELETE /wells/:wellId/pumps/:pumpId", async () => {
    mockApi.del.mockResolvedValueOnce(null);
    const result = await wellsApi.removePump(6, 9);
    expect(mockApi.del).toHaveBeenCalledWith("/wells/6/pumps/9");
    expect(result).toBeNull();
  });

  it("addControlBox calls POST /wells/:wellId/control-boxes with data", async () => {
    const data = { model: "CB-1", voltage: "220" };
    mockApi.post.mockResolvedValueOnce({ data: { control_box_id: 4 } });
    const result = await wellsApi.addControlBox(7, data);
    expect(mockApi.post).toHaveBeenCalledWith("/wells/7/control-boxes", data);
    expect(result).toEqual({ data: { control_box_id: 4 } });
  });

  it("removeControlBox calls DELETE /wells/:wellId/control-boxes/:controlBoxId", async () => {
    mockApi.del.mockResolvedValueOnce(null);
    const result = await wellsApi.removeControlBox(7, 11);
    expect(mockApi.del).toHaveBeenCalledWith("/wells/7/control-boxes/11");
    expect(result).toBeNull();
  });
});
