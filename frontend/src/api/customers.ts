import { api } from "./client";
import type { Customer } from "@/types";

export const customersApi = {
  list: () => api.get<Customer[]>("/customers"),
  create: (data: Partial<Customer>) => api.post<Customer>("/customers", data),
  update: (id: number, data: Partial<Customer>) => api.put<Customer>(`/customers/${id}`, data),
  remove: (id: number) => api.del<void>(`/customers/${id}`),
};
