import { api } from "./client";
import type { DrillingJob, DrillingJobStatus } from "@/types";

export const jobsApi = {
  list: (status?: DrillingJobStatus) => api.get<DrillingJob[]>(status ? `/jobs?status=${status}` : "/jobs"),
  getOne: (id: number | string) => api.get<DrillingJob>(`/jobs/${id}`),
  create: (data: Partial<DrillingJob>) => api.post<DrillingJob>("/jobs", data),
  updateStatus: (id: number | string, status: DrillingJobStatus) => api.patch<DrillingJob>(`/jobs/${id}/status`, { status }),
  generateMagicLink: (id: number | string) => api.post<{ token: string }>(`/jobs/${id}/magic-link`, {}),
  remove: (id: number | string) => api.del<void>(`/jobs/${id}`),

  getByMagicToken: (token: string) => api.get<DrillingJob>(`/jobs/magic/${token}`),
  completeWell: (id: number | string, data: Record<string, unknown>) =>
    api.patch<DrillingJob>(`/jobs/${id}/well`, data),
};
