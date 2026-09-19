import { defineStore } from "pinia";
import { wellsApi } from "@/api/wells";
import type { Well, FullWell, WellStrataLog, WellPipe, WellPump, WellControlBox } from "@/types";

export const useWellsStore = defineStore("wells", {
  state: () => ({
    wells: [] as Well[],
    current: null as FullWell | null,
    loading: false,
  }),
  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        this.wells = await wellsApi.list();
      } finally {
        this.loading = false;
      }
    },
    async fetchOne(id: number | string) {
      this.current = await wellsApi.getOne(id);
      return this.current;
    },
    async addStrata(wellId: number | string, data: Partial<WellStrataLog>) {
      await wellsApi.addStrata(wellId, data);
      await this.fetchOne(wellId);
    },
    async removeStrata(wellId: number | string, strataId: number) {
      await wellsApi.removeStrata(wellId, strataId);
      await this.fetchOne(wellId);
    },
    async addPipe(wellId: number | string, data: Partial<WellPipe>) {
      await wellsApi.addPipe(wellId, data);
      await this.fetchOne(wellId);
    },
    async removePipe(wellId: number | string, pipeId: number) {
      await wellsApi.removePipe(wellId, pipeId);
      await this.fetchOne(wellId);
    },
    async addPump(wellId: number | string, data: Partial<WellPump>) {
      await wellsApi.addPump(wellId, data);
      await this.fetchOne(wellId);
    },
    async removePump(wellId: number | string, pumpId: number) {
      await wellsApi.removePump(wellId, pumpId);
      await this.fetchOne(wellId);
    },
    async addControlBox(wellId: number | string, data: Partial<WellControlBox>) {
      await wellsApi.addControlBox(wellId, data);
      await this.fetchOne(wellId);
    },
    async removeControlBox(wellId: number | string, controlBoxId: number) {
      await wellsApi.removeControlBox(wellId, controlBoxId);
      await this.fetchOne(wellId);
    },
  },
});
