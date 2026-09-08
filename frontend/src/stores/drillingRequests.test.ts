import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { DrillingRequest } from "@/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  updateStatus: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/api/drillingRequests", () => ({
  drillingRequestsApi: {
    list: mocks.list,
    updateStatus: mocks.updateStatus,
    update: mocks.update,
    remove: mocks.remove,
  },
}));

import { useDrillingRequestsStore } from "./drillingRequests";

const req: DrillingRequest = { request_id: 1, customer_id: 2, status: "NEW" } as DrillingRequest;

beforeEach(() => {
  setActivePinia(createPinia());
  for (const fn of Object.values(mocks)) fn.mockReset();
});

describe("drillingRequests store", () => {
  it("fetchAll loads requests", async () => {
    mocks.list.mockResolvedValueOnce([req]);
    const store = useDrillingRequestsStore();
    await store.fetchAll();
    expect(store.requests).toEqual([req]);
    expect(store.loading).toBe(false);
  });

  it("counts new and quoted requests", () => {
    const store = useDrillingRequestsStore();
    store.requests = [
      req,
      { ...req, request_id: 2, status: "QUOTED" } as DrillingRequest,
      { ...req, request_id: 3, status: "QUOTED" } as DrillingRequest,
      { ...req, request_id: 4, status: "ACCEPTED" } as DrillingRequest,
    ];
    expect(store.newCount).toBe(1);
    expect(store.quotedCount).toBe(2);
  });

  it("setStatus replaces the matching request", async () => {
    const updated = { ...req, status: "QUOTED" } as DrillingRequest;
    mocks.updateStatus.mockResolvedValueOnce(updated);
    const store = useDrillingRequestsStore();
    store.requests = [req];
    const out = await store.setStatus(1, "QUOTED");
    expect(mocks.updateStatus).toHaveBeenCalledWith(1, "QUOTED");
    expect(out).toBe(updated);
    expect(store.requests[0]).toEqual(updated);
  });

  it("update replaces the matching request", async () => {
    const updated = { ...req, notes: "x" } as DrillingRequest;
    mocks.update.mockResolvedValueOnce(updated);
    const store = useDrillingRequestsStore();
    store.requests = [req];
    await store.update(1, { notes: "x" });
    expect(mocks.update).toHaveBeenCalledWith(1, { notes: "x" });
    expect(store.requests[0]).toEqual(updated);
  });

  it("remove filters out the request", async () => {
    mocks.remove.mockResolvedValueOnce(undefined);
    const store = useDrillingRequestsStore();
    store.requests = [req, { ...req, request_id: 2 } as DrillingRequest];
    await store.remove(1);
    expect(store.requests.map((r) => r.request_id)).toEqual([2]);
  });
});