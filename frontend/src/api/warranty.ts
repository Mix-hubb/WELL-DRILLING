import { api } from "./client";

export interface WarrantyRecord {
  job_id: number;
  job_reference: string;
  province: string;
  district: string;
  customer_name: string;
  customer_phone: string;
  well_id: number;
  total_depth: number;
  yield_lpm: number | null;
  completion_date: string;
  warranty_expire_date: string;
  warranty_status: "IN_WARRANTY" | "EXPIRED";
  remaining_days: number;
  alert_tier: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";
}

export interface WarrantySummary {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
}

export const warrantyApi = {
  list: (filter?: "active" | "expiring" | "expired") =>
    api.get<WarrantyRecord[]>(`/warranty${filter ? `?filter=${filter}` : ""}`),
  summary: () => api.get<WarrantySummary>("/warranty/summary"),
};
