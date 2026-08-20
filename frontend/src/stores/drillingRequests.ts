import { defineStore } from "pinia";
import { drillingRequestsApi } from "@/api/drillingRequests";
import type { DrillingRequest, DrillingRequestStatus } from "@/types";

export const useDrillingRequestsStore = defineStore("drillingRequests", {
  state: () => ({
    requests: [] as DrillingRequest[],
    loading: false,
  }),
  getters: {
    newCount: (state) => state.requests.filter((r) => r.status === "NEW").length,
    quotedCount: (state) => state.requests.filter((r) => r.status === "QUOTED").length,
  },
  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        this.requests = await drillingRequestsApi.list();
      } finally {
        this.loading = false;
      }
    },
    async setStatus(id: number, status: DrillingRequestStatus) {
      const updated = await drillingRequestsApi.updateStatus(id, status);
      const idx = this.requests.findIndex((r) => r.request_id === id);
      if (idx !== -1) this.requests[idx] = updated;
      return updated;
    },
    async update(id: number, data: Partial<DrillingRequest>) {
      const updated = await drillingRequestsApi.update(id, data);
      const idx = this.requests.findIndex((r) => r.request_id === id);
      if (idx !== -1) this.requests[idx] = updated;
      return updated;
    },
    async remove(id: number) {
      await drillingRequestsApi.remove(id);
      this.requests = this.requests.filter((r) => r.request_id !== id);
    },
  },
});
