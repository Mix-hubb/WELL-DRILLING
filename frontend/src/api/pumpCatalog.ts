import { api } from "./client";
import type { PumpCatalogModel } from "@/types";

export const pumpCatalogApi = {
  list: (params?: { brand?: string; includeInactive?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.brand) query.set("brand", params.brand);
    if (params?.includeInactive) query.set("includeInactive", "true");
    const qs = query.toString();
    return api.get<PumpCatalogModel[]>(`/pump-catalog${qs ? `?${qs}` : ""}`);
  },
  create: (data: Partial<PumpCatalogModel>) => api.post<PumpCatalogModel>("/pump-catalog", data),
  update: (id: number, data: Partial<PumpCatalogModel>) => api.put<PumpCatalogModel>(`/pump-catalog/${id}`, data),
  remove: (id: number) => api.del<void>(`/pump-catalog/${id}`),
};
