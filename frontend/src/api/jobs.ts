import { api, publicApi } from "./client";
import type { DrillingJob, DrillingJobStatus } from "@/types";

/**
 * กัน id ที่เป็น undefined/null/"" ไม่ให้หลุดไปเป็นส่วนหนึ่งของ URL (เช่น /jobs/undefined)
 * เช็กสตริง "undefined"/"null" ด้วย เผื่อค่า undefined ถูกแปลงเป็นสตริงไปแล้วจาก template literal
 * ก่อนถึงจุดนี้ (เช่น router.push(`/jobs/${job.job_id}`) ตอน job.job_id เป็น undefined)
 */
function requireId(id: number | string | undefined | null): string {
  if (id === undefined || id === null || id === "" || id === "undefined" || id === "null") {
    throw new Error("ไม่พบรหัสงาน กรุณารีเฟรชหน้าแล้วลองใหม่");
  }
  return String(id);
}

export const jobsApi = {
  list: (status?: DrillingJobStatus) => api.get<DrillingJob[]>(status ? `/jobs?status=${status}` : "/jobs"),
  getOne: (id: number | string) => api.get<DrillingJob>(`/jobs/${requireId(id)}`),
  create: (data: Partial<DrillingJob>) => api.post<DrillingJob>("/jobs", data),
  update: (id: number | string, data: Partial<DrillingJob>) => api.put<DrillingJob>(`/jobs/${requireId(id)}`, data),
  updateStatus: (id: number | string, status: DrillingJobStatus) => api.patch<DrillingJob>(`/jobs/${requireId(id)}/status`, { status }),
  generateMagicLink: (id: number | string) => api.post<{ token: string }>(`/jobs/${requireId(id)}/magic-link`, {}),
  remove: (id: number | string) => api.del<void>(`/jobs/${requireId(id)}`),

  getByMagicToken: (token: string) => publicApi.get<DrillingJob>(`/jobs/magic/${token}`),
  completeWell: (id: number | string, data: Record<string, unknown>) =>
    publicApi.patch<DrillingJob>(`/jobs/${requireId(id)}/well`, data),
};
