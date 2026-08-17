import { createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/login", name: "login", component: () => import("@/views/LoginView.vue"), meta: { public: true } },
  { path: "/register", name: "register", component: () => import("@/views/RegisterView.vue"), meta: { public: true } },
  { path: "/", redirect: "/dashboard" },

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

  // ===== ลูกค้า (public) =====
  {
    path: "/repair-form", name: "repair-form",
    component: () => import("@/views/RepairFormView.vue"),
    meta: { public: true, hidden: true },
  },

  // ===== ช่าง (magic link, public) =====
  {
    path: "/d/:token", name: "driller-well",
    component: () => import("@/views/DrillerWellView.vue"),
    props: true,
    meta: { public: true, hidden: true },
  },
  {
    path: "/d/repair/:token", name: "driller-repair",
    component: () => import("@/views/DrillerRepairView.vue"),
    props: true,
    meta: { public: true, hidden: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem("welldrill-token");
  if (!to.meta.public && !token) {
    return next("/login");
  }
  if ((to.name === "login" || to.name === "register") && token) {
    return next("/dashboard");
  }
  next();
});
