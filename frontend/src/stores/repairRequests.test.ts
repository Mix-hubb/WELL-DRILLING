import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { RepairRequest } from "@/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  updateStatus: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  addRecord: vi.fn(),
}));

vi.mock("@/api/repairRequests", () => ({
  repairRequestsApi: {
    list: mocks.list,
    updateStatus: mocks.updateStatus,
    update: mocks.update,
    remove: mocks.remove,
    addRecord: mocks.addRecord,
  },
}));

import { useRepairRequestsStore } from "./repairRequests";

const repair: RepairRequest = { repair_id: 1, customer_id: 2, status: "NEW", problems: [] } as RepairRequest;

beforeEach(() => {
  setActivePinia(createPinia());
  for (const fn of Object.values(mocks)) fn.mockReset();
});

describe("repairRequests store", () => {
  it("fetchAll loads requests", async () => {
    mocks.list.mockResolvedValueOnce([repair]);
    const store = useRepairRequestsStore();
    await store.fetchAll();
    expect(store.requests).toEqual([repair]);
    expect(store.loading).toBe(false);
  });

  it("counts new and in-progress requests", () => {
    const store = useRepairRequestsStore();
    store.requests = [
      repair,
      { ...repair, repair_id: 2, status: "IN_PROGRESS" } as RepairRequest,
      { ...repair, repair_id: 3, status: "COMPLETED" } as RepairRequest,
    ];
    expect(store.newCount).toBe(1);
    expect(store.inProgressCount).toBe(1);
  });

  it("setStatus replaces the matching request", async () => {
    const updated = { ...repair, status: "ACCEPTED" } as RepairRequest;
    mocks.updateStatus.mockResolvedValueOnce(updated);
    const store = useRepairRequestsStore();
    store.requests = [repair];
    await store.setStatus(1, "ACCEPTED");
    expect(mocks.updateStatus).toHaveBeenCalledWith(1, "ACCEPTED");
    expect(store.requests[0]).toEqual(updated);
  });

  it("update replaces the matching request", async () => {
    const updated = { ...repair, detail: "ใหม่" } as RepairRequest;
    mocks.update.mockResolvedValueOnce(updated);
    const store = useRepairRequestsStore();
    store.requests = [repair];
    await store.update(1, { detail: "ใหม่" });
    expect(store.requests[0]).toEqual(updated);
  });

  it("remove filters out the request", async () => {
    mocks.remove.mockResolvedValueOnce(undefined);
    const store = useRepairRequestsStore();
    store.requests = [repair, { ...repair, repair_id: 2 } as RepairRequest];
    await store.remove(1);
    expect(store.requests.map((r) => r.repair_id)).toEqual([2]);
  });

  it("addRecord replaces the request with the returned one", async () => {
    const updated = { ...repair, records: [{ record_id: 1 }] } as RepairRequest;
    mocks.addRecord.mockResolvedValueOnce(updated);
    const store = useRepairRequestsStore();
    store.requests = [repair];
    const out = await store.addRecord(1, { final_price: 500 });
    expect(mocks.addRecord).toHaveBeenCalledWith(1, { final_price: 500 });
    expect(out).toBe(updated);
    expect(store.requests[0]).toEqual(updated);
  });
});