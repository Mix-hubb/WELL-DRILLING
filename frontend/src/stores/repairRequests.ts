import { defineStore } from "pinia";
import { repairRequestsApi } from "@/api/repairRequests";
import type { RepairRequest, RepairRequestStatus } from "@/types";

export const useRepairRequestsStore = defineStore("repairRequests", {
  state: () => ({
    requests: [] as RepairRequest[],
    loading: false,
  }),
  getters: {
    newCount: (state) => state.requests.filter((r) => r.status === "NEW").length,
    inProgressCount: (state) => state.requests.filter((r) => r.status === "IN_PROGRESS").length,
  },
  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        this.requests = await repairRequestsApi.list();
      } finally {
        this.loading = false;
      }
    },
    async setStatus(id: number, status: RepairRequestStatus) {
      const updated = await repairRequestsApi.updateStatus(id, status);
      const idx = this.requests.findIndex((r) => r.repair_id === id);
      if (idx !== -1) this.requests[idx] = updated;
      return updated;
    },
    async update(id: number, data: Partial<RepairRequest>) {
      const updated = await repairRequestsApi.update(id, data);
      const idx = this.requests.findIndex((r) => r.repair_id === id);
      if (idx !== -1) this.requests[idx] = updated;
      return updated;
    },
    async remove(id: number) {
      await repairRequestsApi.remove(id);
      this.requests = this.requests.filter((r) => r.repair_id !== id);
    },
    async addRecord(id: number, data: Record<string, unknown>) {
      const updated = await repairRequestsApi.addRecord(id, data);
      const idx = this.requests.findIndex((r) => r.repair_id === id);
      if (idx !== -1) this.requests[idx] = updated;
      return updated;
    },
  },
});
