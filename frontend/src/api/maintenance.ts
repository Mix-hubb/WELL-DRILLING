import { api } from "./client";

export interface MaintenanceLog {
  maintenance_id: number;
  well_id: number;
  event_type_id: number;
  event_type_name: string;
  event_date: string;
  description: string;
  performed_by: string;
  next_service_date: string | null;
  is_warranty_claim: number;
  created_at: string;
}

export interface MaintenanceEventType {
  event_type_id: number;
  type_name: string;
  type_name_th: string;
}

export interface OverdueRecord extends MaintenanceLog {
  days_overdue: number;
  job_reference: string;
  province: string;
  customer_name: string;
  customer_phone: string;
}

export const maintenanceApi = {
  listByWell:  (wellId: number | string) =>
    api.get<MaintenanceLog[]>(`/maintenance/well/${wellId}`),
  listOverdue: () =>
    api.get<OverdueRecord[]>("/maintenance/overdue"),
  listEventTypes: () =>
    api.get<MaintenanceEventType[]>("/maintenance/event-types"),
  create: (wellId: number | string, data: Partial<MaintenanceLog>) =>
    api.post<MaintenanceLog>(`/maintenance/well/${wellId}`, data),
  remove: (id: number) =>
    api.del<void>(`/maintenance/${id}`),
};
