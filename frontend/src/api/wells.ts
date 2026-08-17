import { api } from "./client";
import type { Well, FullWell, WellStrataLog, WellPipe, WellPump, WellControlBox } from "@/types";

export const wellsApi = {
  list: () => api.get<Well[]>("/wells"),
  getOne: (id: number | string) => api.get<FullWell>(`/wells/${id}`),
  getByJob: (jobId: number | string) => api.get<FullWell>(`/wells/by-job/${jobId}`),
  create: (data: { customer_id: number } & Partial<Well>) => api.post<FullWell>("/wells", data),

  addStrata: (wellId: number | string, data: Partial<WellStrataLog>) => api.post<FullWell>(`/wells/${wellId}/strata`, data),
  removeStrata: (wellId: number | string, strataId: number) => api.del<FullWell>(`/wells/${wellId}/strata/${strataId}`),

  addPipe: (wellId: number | string, data: Partial<WellPipe>) => api.post<FullWell>(`/wells/${wellId}/pipes`, data),
  removePipe: (wellId: number | string, pipeId: number) => api.del<FullWell>(`/wells/${wellId}/pipes/${pipeId}`),

  addPump: (wellId: number | string, data: Partial<WellPump>) => api.post<FullWell>(`/wells/${wellId}/pumps`, data),
  removePump: (wellId: number | string, pumpId: number) => api.del<FullWell>(`/wells/${wellId}/pumps/${pumpId}`),

  addControlBox: (wellId: number | string, data: Partial<WellControlBox>) => api.post<FullWell>(`/wells/${wellId}/control-boxes`, data),
  removeControlBox: (wellId: number | string, controlBoxId: number) => api.del<FullWell>(`/wells/${wellId}/control-boxes/${controlBoxId}`),

  reportUrl: (wellId: number | string) => api.fileUrl(`/wells/${wellId}/report.pdf`),
};
