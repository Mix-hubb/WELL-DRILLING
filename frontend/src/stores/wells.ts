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
    async addStrata(wellId: number, data: Partial<WellStrataLog>) {
      this.current = await wellsApi.addStrata(wellId, data);
    },
    async removeStrata(wellId: number, strataId: number) {
      this.current = await wellsApi.removeStrata(wellId, strataId);
    },
    async addPipe(wellId: number, data: Partial<WellPipe>) {
      this.current = await wellsApi.addPipe(wellId, data);
    },
    async removePipe(wellId: number, pipeId: number) {
      this.current = await wellsApi.removePipe(wellId, pipeId);
    },
    async addPump(wellId: number, data: Partial<WellPump>) {
      this.current = await wellsApi.addPump(wellId, data);
    },
    async removePump(wellId: number, pumpId: number) {
      this.current = await wellsApi.removePump(wellId, pumpId);
    },
    async addControlBox(wellId: number, data: Partial<WellControlBox>) {
      this.current = await wellsApi.addControlBox(wellId, data);
    },
    async removeControlBox(wellId: number, controlBoxId: number) {
      this.current = await wellsApi.removeControlBox(wellId, controlBoxId);
    },
  },
});
