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
    async update(id: number, data: Partial<Customer>) {
      const c = await customersApi.update(id, data);
      const idx = this.customers.findIndex((x) => x.customer_id === id);
      if (idx !== -1) this.customers[idx] = c;
      return c;
    },
    async remove(id: number) {
      await customersApi.remove(id);
      this.customers = this.customers.filter((x) => x.customer_id !== id);
    },
  },
});
