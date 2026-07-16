import { api } from "./client";
import type { FullWell, WellLog, WellStrataLog, WellPipe, WellPump } from "@/types";

export interface LithologyType {
  type_id: number;
  type_name: string;
  type_name_th: string;
  color_hex: string;
  pattern: string;
}

export const wellsApi = {
  list: () => api.get<WellLog[]>("/wells"),
  getOne: (id: number | string) => api.get<FullWell>(`/wells/${id}`),
  getByJob: (jobId: number | string) => api.get<FullWell>(`/wells/by-job/${jobId}`),
  create: (data: { job_id: number } & Partial<WellLog>) => api.post<FullWell>("/wells", data),
  getLithologyTypes: () => api.get<LithologyType[]>("/wells/lithology-types"),

  addStrata: (wellId: number | string, data: Partial<WellStrataLog>) => api.post<FullWell>(`/wells/${wellId}/strata`, data),
  removeStrata: (wellId: number | string, strataId: number) => api.del<FullWell>(`/wells/${wellId}/strata/${strataId}`),

  addPipe: (wellId: number | string, data: Partial<WellPipe>) => api.post<FullWell>(`/wells/${wellId}/pipes`, data),
  removePipe: (wellId: number | string, pipeId: number) => api.del<FullWell>(`/wells/${wellId}/pipes/${pipeId}`),

  addPump: (wellId: number | string, data: Partial<WellPump>) => api.post<FullWell>(`/wells/${wellId}/pumps`, data),
  removePump: (wellId: number | string, pumpId: number) => api.del<FullWell>(`/wells/${wellId}/pumps/${pumpId}`),

  reportUrl: (wellId: number | string) => api.fileUrl(`/wells/${wellId}/report.pdf`),
};
