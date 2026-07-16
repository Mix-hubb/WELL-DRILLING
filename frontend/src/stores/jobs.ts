import { defineStore } from "pinia";
import { jobsApi } from "@/api/jobs";
import type { DrillingJob, JobStatus } from "@/types";

export const useJobsStore = defineStore("jobs", {
  state: () => ({
    jobs: [] as DrillingJob[],
    loading: false,
  }),
  getters: {
    byStatus: (state) => (status: JobStatus) => state.jobs.filter((j) => j.status === status),
    pendingCount: (state) => state.jobs.filter((j) => j.status === "PENDING").length,
    drillingCount: (state) => state.jobs.filter((j) => j.status === "DRILLING").length,
    completedCount: (state) => state.jobs.filter((j) => j.status === "COMPLETED").length,
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
    async setStatus(id: number, status: JobStatus) {
      const updated = await jobsApi.updateStatus(id, status);
      const idx = this.jobs.findIndex((j) => j.job_id === id);
      if (idx !== -1) this.jobs[idx] = updated;
      return updated;
    },
    async setFinalPrice(id: number, price: number) {
      const updated = await jobsApi.updateFinalPrice(id, price);
      const idx = this.jobs.findIndex((j) => j.job_id === id);
      if (idx !== -1) this.jobs[idx] = updated;
      return updated;
    },
  },
});
