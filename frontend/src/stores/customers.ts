import { defineStore } from "pinia";
import { customersApi } from "@/api/customers";
import type { Customer } from "@/types";

export const useCustomersStore = defineStore("customers", {
  state: () => ({
    customers: [] as Customer[],
    loading: false,
  }),
  actions: {
    async fetchAll() {
      this.loading = true;
      try {
        this.customers = await customersApi.list();
      } finally {
        this.loading = false;
      }
    },
  },
});
