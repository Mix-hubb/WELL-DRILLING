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
    async update(id: number, data: Partial<DrillingJob>) {
      const updated = await jobsApi.update(id, data);
      const idx = this.jobs.findIndex((j) => j.job_id === id);
      if (idx !== -1) this.jobs[idx] = updated;
      return updated;
    },
    async remove(id: number) {
      await jobsApi.remove(id);
      this.jobs = this.jobs.filter((j) => j.job_id !== id);
    },
  },
});
