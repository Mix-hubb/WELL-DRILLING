import { api } from "./client";

export interface AuthUser {
  user_id: number;
  email: string;
  full_name: string;
  role: "ADMIN" | "DRILLER";
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }),

  register: (email: string, password: string, full_name: string, role?: string) =>
    api.post<AuthResponse>("/auth/register", { email, password, full_name, role }),

  me: () => api.get<AuthUser>("/auth/me"),
};
