import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { Customer } from "@/types";

const mocks = vi.hoisted(() => ({ list: vi.fn() }));

vi.mock("@/api/customers", () => ({
  customersApi: { list: mocks.list },
}));

import { useCustomersStore } from "./customers";

const customer: Customer = { customer_id: 1, customer_name: "สมชาย", phone: "081" } as Customer;

beforeEach(() => {
  setActivePinia(createPinia());
  mocks.list.mockReset();
});

describe("customers store", () => {
  it("fetchAll loads customers and clears the loading flag", async () => {
    mocks.list.mockResolvedValueOnce([customer]);
    const store = useCustomersStore();
    const promise = store.fetchAll();
    expect(store.loading).toBe(true);
    await promise;
    expect(store.customers).toEqual([customer]);
    expect(store.loading).toBe(false);
  });

  it("keeps loading=false even when the request fails", async () => {
    mocks.list.mockRejectedValueOnce(new Error("net"));
    const store = useCustomersStore();
    await expect(store.fetchAll()).rejects.toThrow("net");
    expect(store.loading).toBe(false);
  });
});