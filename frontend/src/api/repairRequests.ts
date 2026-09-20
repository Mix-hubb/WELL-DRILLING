import { api, publicApi } from "./client";
import type { RepairRequest, PaymentSlip, RepairRecord } from "@/types";

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

  getByMagicToken: (token: string) => publicApi.get<RepairRequest>(`/repair-requests/magic/${token}`),
  addRecord: (id: number | string, data: Record<string, unknown>) =>
    publicApi.post<RepairRequest>(`/repair-requests/${id}/records`, data),

  getPaymentSlips: (id: number | string) =>
    api.get<PaymentSlip[]>(`/repair-requests/${id}/payment-slips`),
  verifyPaymentSlip: (id: number | string, slipId: string, data: { status: "VERIFIED" | "REJECTED"; notes?: string }) =>
    api.patch<PaymentSlip>(`/repair-requests/${id}/payment-slips/${slipId}`, data),
  downloadReceiptPdf: (id: number | string) =>
    api.download(`/repair-requests/${id}/receipt.pdf`, `receipt-repair-${id}.pdf`),
  sendReceipt: (id: number | string) =>
    api.post<{ ok: boolean; message: string }>(`/repair-requests/${id}/send-receipt`, {}),
};

export const repairRecordsApi = {
  getOne: (id: number | string) => api.get<RepairRecord>(`/repair-records/${id}`),
  update: (id: number | string, data: Partial<RepairRecord>) => api.put<RepairRecord>(`/repair-records/${id}`, data),
  remove: (id: number | string) => api.del<void>(`/repair-records/${id}`),
};


