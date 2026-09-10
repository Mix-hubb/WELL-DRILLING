import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApi = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock("./client", () => ({
  api: mockApi,
}));

import { statsApi } from "./stats";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("statsApi", () => {
  it("overview calls GET /stats/overview", async () => {
    const overviewData = {
      totalCustomers: 10,
      totalWells: 25,
      totalJobs: 30,
      activeJobs: 5,
    };
    mockApi.get.mockResolvedValueOnce({ data: overviewData });
    const result = await statsApi.overview();
    expect(mockApi.get).toHaveBeenCalledWith("/stats/overview");
    expect(result).toEqual({ data: overviewData });
  });

  it("overview returns empty data when none available", async () => {
    mockApi.get.mockResolvedValueOnce({ data: null });
    const result = await statsApi.overview();
    expect(mockApi.get).toHaveBeenCalledWith("/stats/overview");
    expect(result).toEqual({ data: null });
  });
});
