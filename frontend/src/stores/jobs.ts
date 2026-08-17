import { defineStore } from "pinia";
import { jobsApi } from "@/api/jobs";
import type { DrillingJob, DrillingJobStatus } from "@/types";

export const useJobsStore = defineStore("jobs", {
  state: () => ({
    jobs: [] as DrillingJob[],
    loading: false,
  }),
  getters: {
    byStatus: (state) => (status: DrillingJobStatus) => state.jobs.filter((j) => j.status === status),
    queuedCount: (state) => state.jobs.filter((j) => j.status === "QUEUED").length,
    drillingCount: (state) => state.jobs.filter((j) => j.status === "DRILLING").length,
    successCount: (state) => state.jobs.filter((j) => j.status === "SUCCESS").length,
  },
  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        this.jobs = await jobsApi.list();
      } finally {
        this.loading = false;
      }
    },
    async create(data: Partial<DrillingJob>) {
      const job = await jobsApi.create(data);
      this.jobs.unshift(job);
      return job;
    },
    async setStatus(id: number, status: DrillingJobStatus) {
      const updated = await jobsApi.updateStatus(id, status);
      const idx = this.jobs.findIndex((j) => j.job_id === id);
      if (idx !== -1) this.jobs[idx] = updated;
      return updated;
    },
  },
});
