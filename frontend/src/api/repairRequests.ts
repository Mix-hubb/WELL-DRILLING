import { api } from "./client";
import type { RepairRequest } from "@/types";

export const repairRequestsApi = {
  list: () => api.get<RepairRequest[]>("/repair-requests"),
  getOne: (id: number | string) => api.get<RepairRequest>(`/repair-requests/${id}`),
  create: (data: Partial<RepairRequest>) => api.post<RepairRequest>("/repair-requests", data),
  update: (id: number | string, data: Partial<RepairRequest>) => api.put<RepairRequest>(`/repair-requests/${id}`, data),
  updateStatus: (id: number | string, status: RepairRequest["status"]) =>
    api.patch<RepairRequest>(`/repair-requests/${id}/status`, { status }),
  generateMagicLink: (id: number | string) => api.post<{ token: string }>(`/repair-requests/${id}/magic-link`, {}),
  remove: (id: number | string) => api.del<void>(`/repair-requests/${id}`),

  getByMagicToken: (token: string) => api.get<RepairRequest>(`/repair-requests/magic/${token}`),
  addRecord: (id: number | string, data: Record<string, unknown>) =>
    api.post<RepairRequest>(`/repair-requests/${id}/records`, data),

  createPublic: (data: Record<string, unknown>) =>
    api.post<{ repair_id: number; customer_id: number }>("/public/repair-requests", data),
};
