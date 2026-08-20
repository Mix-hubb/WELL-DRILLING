import { api } from "./client";
import type { Quotation } from "@/types";

export const quotationsApi = {
  createDrilling: (requestId: number, data: { price: number; notes?: string; requested_depth_m?: number | null; requested_diameter_m?: number | null }) =>
    api.post<Quotation>("/quotations", { kind: "DRILLING", drilling_request_id: requestId, ...data }),
  createRepair: (requestId: number, data: { price: number; notes?: string }) =>
    api.post<Quotation>("/quotations", { kind: "REPAIR", repair_request_id: requestId, ...data }),
};
