import { createRouter, createWebHistory, type NavigationGuardNext, type RouteLocationNormalized } from "vue-router";

const routes = [
  { path: "/login", name: "login", component: () => import("@/views/LoginView.vue"), meta: { public: true } },
  { path: "/register", name: "register", component: () => import("@/views/RegisterView.vue"), meta: { public: true } },
  { path: "/forgot-password", name: "forgot-password", component: () => import("@/views/ForgotPasswordView.vue"), meta: { public: true } },
  { path: "/reset-password", name: "reset-password", component: () => import("@/views/ResetPasswordView.vue"), meta: { public: true } },
  { path: "/", redirect: "/login" },

  // ===== ผู้ประกอบการ =====
  {
    path: "/dashboard", name: "dashboard",
    component: () => import("@/views/DashboardView.vue"),
    meta: { label: "แดชบอร์ด", icon: "mdi-view-dashboard-outline" },
  },
  {
    path: "/jobs", name: "jobs",
    component: () => import("@/views/JobsView.vue"),
    meta: { label: "คิวงาน", icon: "mdi-hammer-wrench" },
  },
  {
    path: "/jobs/:id", name: "job-detail",
    component: () => import("@/views/JobDetailView.vue"),
    props: true,
    meta: { hidden: true },
  },
  {
    path: "/drilling-requests", name: "drilling-requests",
    component: () => import("@/views/DrillingRequestsView.vue"),
    meta: { label: "คำร้องแจ้งเจาะ", icon: "mdi-file-document-plus-outline" },
  },
  {
    path: "/repair-requests", name: "repair-requests",
    component: () => import("@/views/RepairRequestsView.vue"),
    meta: { label: "รายการแจ้งซ่อม", icon: "mdi-wrench-outline" },
  },
  {
    path: "/repair-requests/:id", name: "repair-detail",
    component: () => import("@/views/RepairDetailView.vue"),
    props: true,
    meta: { hidden: true },
  },
  {
    path: "/wells", name: "wells",
    component: () => import("@/views/WellsView.vue"),
    meta: { label: "ดูประวัติบ่อบาดาล", icon: "mdi-layers-outline" },
  },
  {
    path: "/wells/customer/:id", name: "customer-wells",
    component: () => import("@/views/CustomerWellsView.vue"),
    props: true,
    meta: { hidden: true },
  },
  {
    path: "/wells/:id", name: "well-detail",
    component: () => import("@/views/WellDetailView.vue"),
    props: true,
    meta: { hidden: true },
  },
  {
    path: "/settings", name: "settings",
    component: () => import("@/views/SettingsView.vue"),
    meta: { label: "ตั้งค่าระบบ", icon: "mdi-cog-outline" },
  },
  // ===== ลูกค้า (public) =====
  {
    path: "/request-drill",
    name: "request-drill",
    component: () => import("@/views/DrillingRequestFormView.vue"),
    meta: { public: true, hidden: true },
  },
  {
    path: "/repair-form",
    name: "repair-form",
    component: () => import("@/views/RepairFormView.vue"),
    meta: { public: true, hidden: true },
  },
  // ===== ช่าง (magic link, public) =====
  {
    path: "/d/repair/:token", name: "driller-repair",
    component: () => import("@/views/DrillerRepairView.vue"),
    props: true,
    meta: { public: true, hidden: true },
  },
  {
    path: "/d/:token", name: "driller-well",
    component: () => import("@/views/DrillerWellView.vue"),
    props: true,
    meta: { public: true, hidden: true },
  },
  { path: "/:pathMatch(.*)*", redirect: "/login" },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, _from, next) => {
  const token = localStorage.getItem("welldrill-token");

  const urlLiffId = to.query.liffId as string | undefined;
  if (urlLiffId && (to.path === "/" || to.path === "/login")) {
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";
      const res = await fetch(`${BASE_URL}/public/liff-info?liff_id=${encodeURIComponent(urlLiffId)}`);
      const data = await res.json();
      if (data.found && data.formType) {
        return next({ path: `/${data.formType}`, query: { liffId: urlLiffId } });
      }
    } catch {
      // fallback: show login
    }
  }

  if (!to.meta.public && !token) {
    return next("/login");
  }
  if ((to.name === "login" || to.name === "register") && token) {
    return next("/dashboard");
  }
  next();
});
