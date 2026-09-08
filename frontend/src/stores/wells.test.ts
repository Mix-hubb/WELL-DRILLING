import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { FullWell, Well, WellStrataLog } from "@/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  getOne: vi.fn(),
  addStrata: vi.fn(),
  removeStrata: vi.fn(),
  addPipe: vi.fn(),
  removePipe: vi.fn(),
  addPump: vi.fn(),
  removePump: vi.fn(),
  addControlBox: vi.fn(),
  removeControlBox: vi.fn(),
}));

vi.mock("@/api/wells", () => ({
  wellsApi: {
    list: mocks.list,
    getOne: mocks.getOne,
    addStrata: mocks.addStrata,
    removeStrata: mocks.removeStrata,
    addPipe: mocks.addPipe,
    removePipe: mocks.removePipe,
    addPump: mocks.addPump,
    removePump: mocks.removePump,
    addControlBox: mocks.addControlBox,
    removeControlBox: mocks.removeControlBox,
  },
}));

import { useWellsStore } from "./wells";

const well: Well = { well_id: 1, customer_id: 2, well_name: "บ่อ1" } as Well;
const fullWell: FullWell = { ...well, strata: [], pipes: [], pumps: [], control_boxes: [] };

beforeEach(() => {
  setActivePinia(createPinia());
  for (const fn of Object.values(mocks)) fn.mockReset();
});

describe("wells store", () => {
  it("fetchAll loads wells and clears loading", async () => {
    mocks.list.mockResolvedValueOnce([well]);
    const store = useWellsStore();
    const promise = store.fetchAll();
    expect(store.loading).toBe(true);
    await promise;
    expect(store.wells).toEqual([well]);
    expect(store.loading).toBe(false);
  });

  it("fetchOne sets the current full well", async () => {
    mocks.getOne.mockResolvedValueOnce(fullWell);
    const store = useWellsStore();
    const result = await store.fetchOne(1);
    expect(mocks.getOne).toHaveBeenCalledWith(1);
    expect(store.current).toEqual(fullWell);
    expect(result).toEqual(fullWell);
  });

  it("addStrata updates the current well", async () => {
    const strata: WellStrataLog = { strata_id: 1, well_id: 1, depth_from_m: 0, depth_to_m: 5 } as WellStrataLog;
    const after = { ...fullWell, strata: [strata] };
    mocks.addStrata.mockResolvedValueOnce(after);
    const store = useWellsStore();
    store.current = fullWell;
    await store.addStrata(1, { depth_from_m: 0, depth_to_m: 5 });
    expect(mocks.addStrata).toHaveBeenCalledWith(1, { depth_from_m: 0, depth_to_m: 5 });
    expect(store.current?.strata).toEqual([strata]);
  });

  it("removeStrata updates the current well", async () => {
    mocks.removeStrata.mockResolvedValueOnce(fullWell);
    const store = useWellsStore();
    store.current = { ...fullWell, strata: [{ strata_id: 1 } as WellStrataLog] };
    await store.removeStrata(1, 1);
    expect(mocks.removeStrata).toHaveBeenCalledWith(1, 1);
    expect(store.current).toEqual(fullWell);
  });

  it("delegates pipes, pumps and control boxes to the api", async () => {
    mocks.addPipe.mockResolvedValueOnce(fullWell);
    mocks.removePump.mockResolvedValueOnce(fullWell);
    mocks.addControlBox.mockResolvedValueOnce(fullWell);
    const store = useWellsStore();
    await store.addPipe(1, { material: "PVC" });
    await store.removePump(1, 9);
    await store.addControlBox(1, { brand: "X" });
    expect(mocks.addPipe).toHaveBeenCalledWith(1, { material: "PVC" });
    expect(mocks.removePump).toHaveBeenCalledWith(1, 9);
    expect(mocks.addControlBox).toHaveBeenCalledWith(1, { brand: "X" });
    expect(mocks.removePipe).not.toHaveBeenCalled();
  });
});