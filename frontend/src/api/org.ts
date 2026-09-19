import { api } from "./client";

export interface OrgInfo {
  org_id: string;
  name: string;
  slug: string;
  invite_code: string;
  created_at: string;
}

export interface OrgMember {
  user_id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  role: "ADMIN" | "DRILLER";
  created_at: string;
}

export const orgApi = {
  getInfo: () => api.get<OrgInfo>("/org/info"),
  getMembers: () => api.get<OrgMember[]>("/org/members"),
  updateRole: (userId: string, role: "ADMIN" | "DRILLER") =>
    api.patch<{ message: string; role: string }>(`/org/members/${userId}/role`, { role }),
  removeMember: (userId: string) => api.del<void>(`/org/members/${userId}`),
};
