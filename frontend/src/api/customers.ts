import { api } from "./client";
import type { Customer, Well, DrillingJob, DrillingRequest, RepairRequest } from "@/types";

export interface CustomerOverview {
  customer: Customer;
  wells: Well[];
  jobs: DrillingJob[];
  drillingRequests: DrillingRequest[];
  repairRequests: RepairRequest[];
}

export const customersApi = {
  list: () => api.get<Customer[]>("/customers"),
  getOne: (id: number | string) => api.get<Customer>(`/customers/${id}`),
  overview: (id: number | string) => api.get<CustomerOverview>(`/customers/${id}/overview`),
  create: (data: Partial<Customer>) => api.post<Customer>("/customers", data),
  update: (id: number, data: Partial<Customer>) => api.put<Customer>(`/customers/${id}`, data),
  remove: (id: number) => api.del<void>(`/customers/${id}`),
};
