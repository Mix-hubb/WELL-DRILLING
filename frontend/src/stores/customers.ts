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
    async create(data: Partial<Customer>) {
      const c = await customersApi.create(data);
      this.customers.unshift(c);
      return c;
    },
  },
});
