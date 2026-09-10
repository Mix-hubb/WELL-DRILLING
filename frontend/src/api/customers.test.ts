import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApi = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue({ data: null }),
  post: vi.fn().mockResolvedValue({ data: null }),
  put: vi.fn().mockResolvedValue({ data: null }),
  del: vi.fn().mockResolvedValue(null),
}));

vi.mock("./client", () => ({
  api: mockApi,
}));

import { customersApi } from "./customers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("customersApi", () => {
  it("list calls GET /customers", async () => {
    mockApi.get.mockResolvedValueOnce({ data: [{ id: 1 }] });
    const result = await customersApi.list();
    expect(mockApi.get).toHaveBeenCalledWith("/customers");
    expect(result).toEqual({ data: [{ id: 1 }] });
  });

  it("overview calls GET /customers/:id/overview", async () => {
    mockApi.get.mockResolvedValueOnce({ data: { customer: {}, wells: [] } });
    const result = await customersApi.overview(5);
    expect(mockApi.get).toHaveBeenCalledWith("/customers/5/overview");
    expect(result).toEqual({ data: { customer: {}, wells: [] } });
  });

  it("overview accepts string id", async () => {
    mockApi.get.mockResolvedValueOnce({ data: { customer: {} } });
    await customersApi.overview("abc");
    expect(mockApi.get).toHaveBeenCalledWith("/customers/abc/overview");
  });

  it("create calls POST /customers with data", async () => {
    const data = { customer_name: "Test Customer", phone: "0812345678" };
    mockApi.post.mockResolvedValueOnce({ data: { customer_id: 1, ...data } });
    const result = await customersApi.create(data);
    expect(mockApi.post).toHaveBeenCalledWith("/customers", data);
    expect(result).toEqual({ data: { customer_id: 1, ...data } });
  });

  it("update calls PUT /customers/:id with data", async () => {
    const data = { customer_name: "Updated" };
    mockApi.put.mockResolvedValueOnce({ data: { customer_id: 3, ...data } });
    const result = await customersApi.update(3, data);
    expect(mockApi.put).toHaveBeenCalledWith("/customers/3", data);
    expect(result).toEqual({ data: { customer_id: 3, ...data } });
  });

  it("remove calls DELETE /customers/:id", async () => {
    mockApi.del.mockResolvedValueOnce(null);
    const result = await customersApi.remove(7);
    expect(mockApi.del).toHaveBeenCalledWith("/customers/7");
    expect(result).toBeNull();
  });
});
