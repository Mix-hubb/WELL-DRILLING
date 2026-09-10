import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApi = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ data: null }),
}));

vi.mock("./client", () => ({
  api: mockApi,
}));

import { pumpCatalogApi } from "./pumpCatalog";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pumpCatalogApi", () => {
  it("list calls GET /pump-catalog without brand", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [{ id: 1, brand: "Grundfos" }] });
    const result = await pumpCatalogApi.list();
    expect(mockApi.get).toHaveBeenCalledWith("/pump-catalog");
    expect(result).toEqual({ data: [{ id: 1, brand: "Grundfos" }] });
  });

  it("list calls GET /pump-catalog?brand=X when brand provided", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [{ id: 2, brand: "Franklin" }] });
    await pumpCatalogApi.list("Franklin");
    expect(mockApi.get).toHaveBeenCalledWith("/pump-catalog?brand=Franklin");
  });

  it("list encodes brand with special characters", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });
    await pumpCatalogApi.list("Brand & Co.");
    expect(mockApi.get).toHaveBeenCalledWith("/pump-catalog?brand=Brand%20%26%20Co.");
  });

  it("list returns empty data when no results", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [] });
    const result = await pumpCatalogApi.list("Nonexistent");
    expect(result).toEqual({ data: [] });
  });
});
