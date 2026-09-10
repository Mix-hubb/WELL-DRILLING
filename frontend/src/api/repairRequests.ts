import { api } from "./client";
import type { RepairRequest, PaymentSlip } from "@/types";

export const repairRequestsApi = {
  list: () => api.get<RepairRequest[]>("/repair-requests"),
  getOne: (id: number | string) => api.get<RepairRequest>(`/repair-requests/${id}`),
  create: (data: Partial<RepairRequest>) => api.post<RepairRequest>("/repair-requests", data),
  update: (id: number | string, data: Partial<RepairRequest>) => api.put<RepairRequest>(`/repair-requests/${id}`, data),
  updateStatus: (id: number | string, status: RepairRequest["status"], scheduled_date?: string) =>
    api.patch<RepairRequest>(
      `/repair-requests/${id}/status`,
      scheduled_date !== undefined ? { status, scheduled_date } : { status }
    ),
  generateMagicLink: (id: number | string) => api.post<{ token: string }>(`/repair-requests/${id}/magic-link`, {}),
  remove: (id: number | string) => api.del<void>(`/repair-requests/${id}`),

  getByMagicToken: (token: string) => api.get<RepairRequest>(`/repair-requests/magic/${token}`),
  addRecord: (id: number | string, data: Record<string, unknown>) =>
    api.post<RepairRequest>(`/repair-requests/${id}/records`, data),

  getPaymentSlips: (id: number | string) =>
    api.get<PaymentSlip[]>(`/repair-requests/${id}/payment-slips`),
  verifyPaymentSlip: (id: number | string, slipId: string, data: { status: "VERIFIED" | "REJECTED"; notes?: string }) =>
    api.patch<PaymentSlip>(`/repair-requests/${id}/payment-slips/${slipId}`, data),
};

