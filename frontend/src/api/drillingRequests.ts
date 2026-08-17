import { api } from "./client";
import type { DrillingRequest } from "@/types";

export const drillingRequestsApi = {
  list: () => api.get<DrillingRequest[]>("/drilling-requests"),
  getOne: (id: number | string) => api.get<DrillingRequest>(`/drilling-requests/${id}`),
  create: (data: Partial<DrillingRequest>) => api.post<DrillingRequest>("/drilling-requests", data),
  updateStatus: (id: number | string, status: DrillingRequest["status"]) =>
    api.patch<DrillingRequest>(`/drilling-requests/${id}/status`, { status }),
  remove: (id: number | string) => api.del<void>(`/drilling-requests/${id}`),
};
