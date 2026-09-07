import { api } from "./client";

export interface AuthUser {
  user_id: number;
  email: string;
  full_name: string;
  role: "ADMIN" | "DRILLER";
  org_id?: string | null;
  org_name?: string | null;
  org_slug?: string | null;
  invite_code?: string | null;
  line_configured?: boolean;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }),

  register: (email: string, password: string, full_name: string, phone: string, opts?: { org_name?: string; invite_code?: string }) =>
    api.post<AuthResponse>("/auth/register", { email, password, full_name, phone, ...opts }),

  me: () => api.get<AuthUser>("/auth/me"),

  forgotPassword: (email: string, method: "email" | "sms") =>
    api.post<{ message: string }>("/auth/forgot-password", { email, method }),

  verifyCode: (email: string, code: string) =>
    api.post<{ message: string }>("/auth/verify-code", { email, code }),

  resetPassword: (email: string, code: string, newPassword: string) =>
    api.post<{ message: string }>("/auth/reset-password", { email, code, newPassword }),
};
