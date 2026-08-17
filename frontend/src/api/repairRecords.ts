import { api } from "./client";
import type { RepairRecord } from "@/types";

export const repairRecordsApi = {
  list: () => api.get<RepairRecord[]>("/repair-records"),
  getOne: (id: number | string) => api.get<RepairRecord>(`/repair-records/${id}`),
  remove: (id: number | string) => api.del<void>(`/repair-records/${id}`),
};
