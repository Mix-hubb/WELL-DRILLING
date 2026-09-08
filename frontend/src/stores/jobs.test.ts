import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { DrillingJob } from "@/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/api/jobs", () => ({
  jobsApi: { list: mocks.list, create: mocks.create, update: mocks.update, remove: mocks.remove },
}));

import { useJobsStore } from "./jobs";

const job: DrillingJob = { job_id: 1, customer_id: 2, status: "QUEUED" } as DrillingJob;

beforeEach(() => {
  setActivePinia(createPinia());
  mocks.list.mockReset();
  mocks.create.mockReset();
  mocks.update.mockReset();
  mocks.remove.mockReset();
});

describe("jobs store", () => {
  it("fetchAll loads jobs and manages the loading flag", async () => {
    mocks.list.mockResolvedValueOnce([job]);
    const store = useJobsStore();
    const promise = store.fetchAll();
    expect(store.loading).toBe(true);
    await promise;
    expect(store.jobs).toEqual([job]);
    expect(store.loading).toBe(false);
  });

  it("create prepends the new job", async () => {
    const fresh = { ...job, job_id: 2, status: "DRILLING" } as DrillingJob;
    mocks.create.mockResolvedValueOnce(fresh);
    const store = useJobsStore();
    store.jobs = [job];
    await store.create({ job_title: "งานใหม่" });
    expect(mocks.create).toHaveBeenCalledWith({ job_title: "งานใหม่" });
    expect(store.jobs).toEqual([fresh, job]);
  });

  it("update replaces the matching job by id", async () => {
    const updated = { ...job, status: "SUCCESS" } as DrillingJob;
    mocks.update.mockResolvedValueOnce(updated);
    const other = { ...job, job_id: 2 } as DrillingJob;
    const store = useJobsStore();
    store.jobs = [job, other];
    await store.update(1, { status: "SUCCESS" });
    expect(mocks.update).toHaveBeenCalledWith(1, { status: "SUCCESS" });
    expect(store.jobs[0]).toEqual(updated);
    expect(store.jobs[1]).toEqual(other);
  });

  it("remove deletes the job from the list", async () => {
    mocks.remove.mockResolvedValueOnce(undefined);
    const store = useJobsStore();
    store.jobs = [job, { ...job, job_id: 2 } as DrillingJob];
    await store.remove(1);
    expect(store.jobs.map((j) => j.job_id)).toEqual([2]);
  });

  it("byStatus filters the queued jobs", () => {
    const store = useJobsStore();
    store.jobs = [job, { ...job, job_id: 2, status: "DRILLING" } as DrillingJob];
    expect(store.byStatus("QUEUED").map((j) => j.job_id)).toEqual([1]);
    expect(store.byStatus("DRILLING").map((j) => j.job_id)).toEqual([2]);
  });
});