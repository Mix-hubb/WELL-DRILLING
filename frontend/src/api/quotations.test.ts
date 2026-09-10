import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApi = vi.hoisted(() => ({
  post: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock("./client", () => ({
  api: mockApi,
}));

import { quotationsApi } from "./quotations";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quotationsApi", () => {
  it("createDrilling calls POST /quotations with kind=DRILLING and all fields", async () => {
    const data = { price: 50000, notes: "drill well", requested_depth_m: 30, requested_diameter_m: 0.5 };
    mockApi.post.mockResolvedValueOnce({ data: { id: 1, ...data } });
    const result = await quotationsApi.createDrilling(10, data);
    expect(mockApi.post).toHaveBeenCalledWith("/quotations", {
      kind: "DRILLING",
      drilling_request_id: 10,
      price: 50000,
      notes: "drill well",
      requested_depth_m: 30,
      requested_diameter_m: 0.5,
    });
    expect(result).toEqual({ data: { id: 1, ...data } });
  });

  it("createDrilling sends minimal data without optional fields", async () => {
    const data = { price: 10000, notes: "basic" };
    mockApi.post.mockResolvedValueOnce({ data: { id: 2 } });
    await quotationsApi.createDrilling(5, data);
    expect(mockApi.post).toHaveBeenCalledWith("/quotations", {
      kind: "DRILLING",
      drilling_request_id: 5,
      price: 10000,
      notes: "basic",
    });
  });

  it("createRepair calls POST /quotations with kind=REPAIR and all fields", async () => {
    const data = { price: 8000, notes: "repair pump" };
    mockApi.post.mockResolvedValueOnce({ data: { id: 3, ...data } });
    const result = await quotationsApi.createRepair(20, data);
    expect(mockApi.post).toHaveBeenCalledWith("/quotations", {
      kind: "REPAIR",
      repair_request_id: 20,
      price: 8000,
      notes: "repair pump",
    });
    expect(result).toEqual({ data: { id: 3, ...data } });
  });

  it("createRepair works with minimal data", async () => {
    mockApi.post.mockResolvedValueOnce({ data: { id: 4 } });
    await quotationsApi.createRepair(15, { price: 5000 });
    expect(mockApi.post).toHaveBeenCalledWith("/quotations", {
      kind: "REPAIR",
      repair_request_id: 15,
      price: 5000,
    });
  });
});
