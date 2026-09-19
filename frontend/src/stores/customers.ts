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
      const created = await customersApi.create(data);
      this.customers.unshift(created);
      return created;
    },
    async update(id: number, data: Partial<Customer>) {
      const updated = await customersApi.update(id, data);
      const idx = this.customers.findIndex((c) => c.customer_id === id);
      if (idx !== -1) this.customers[idx] = updated;
      return updated;
    },
    async remove(id: number) {
      await customersApi.remove(id);
      this.customers = this.customers.filter((c) => c.customer_id !== id);
    },
  },
});

