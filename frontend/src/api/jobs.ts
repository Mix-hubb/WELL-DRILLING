import { api } from "./client";
import type { DrillingJob, JobStatus } from "@/types";

export const jobsApi = {
  list: (status?: JobStatus) => api.get<DrillingJob[]>(status ? `/jobs?status=${status}` : "/jobs"),
  getOne: (id: number | string) => api.get<DrillingJob>(`/jobs/${id}`),
  create: (data: Partial<DrillingJob>) => api.post<DrillingJob>("/jobs", data),
  updateStatus: (id: number | string, status: JobStatus) => api.patch<DrillingJob>(`/jobs/${id}/status`, { status }),
  updateFinalPrice: (id: number | string, final_price: number) => api.patch<DrillingJob>(`/jobs/${id}/price`, { final_price }),
  remove: (id: number | string) => api.del<void>(`/jobs/${id}`),
};
