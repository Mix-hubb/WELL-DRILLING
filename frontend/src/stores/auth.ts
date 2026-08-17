import { defineStore } from "pinia";
import { authApi, type AuthUser } from "@/api/auth";
import { useUiStore } from "./ui";

const TOKEN_KEY = "welldrill-token";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || "",
    user: null as AuthUser | null,
  }),
  getters: {
    isLoggedIn: (state) => !!state.token,
    fullName: (state) => state.user?.full_name || "",
  },
  actions: {
    setToken(token: string) {
      this.token = token;
      localStorage.setItem(TOKEN_KEY, token);
    },
    clearAuth() {
      this.token = "";
      this.user = null;
      localStorage.removeItem(TOKEN_KEY);
    },
    async login(email: string, password: string) {
      const res = await authApi.login(email, password);
      this.setToken(res.token);
      this.user = res.user;
      return res;
    },
    async register(email: string, password: string, full_name: string) {
      const res = await authApi.register(email, password, full_name);
      this.setToken(res.token);
      this.user = res.user;
      return res;
    },
    async fetchUser() {
      if (!this.token) return;
      try {
        this.user = await authApi.me();
      } catch {
        this.clearAuth();
      }
    },
    logout() {
      this.clearAuth();
      useUiStore().notify("ออกจากระบบแล้ว", "info");
    },
  },
});
