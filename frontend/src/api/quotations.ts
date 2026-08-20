import { api } from "./client";
import type { Quotation, QuotationStatus } from "@/types";

export const quotationsApi = {
  createDrilling: (requestId: number, data: { price: number; notes?: string; requested_depth_m?: number | null; requested_diameter_m?: number | null }) =>
    api.post<Quotation>("/quotations", { kind: "DRILLING", drilling_request_id: requestId, ...data }),
  createRepair: (requestId: number, data: { price: number; notes?: string }) =>
    api.post<Quotation>("/quotations", { kind: "REPAIR", repair_request_id: requestId, ...data }),
  updateStatus: (id: number | string, status: QuotationStatus) =>
    api.patch<Quotation>(`/quotations/${id}/status`, { status }),
  remove: (id: number | string) => api.del<void>(`/quotations/${id}`),
};
