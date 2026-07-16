import { createRouter, createWebHistory } from "vue-router";

const routes = [
  { path: "/login", name: "login", component: () => import("@/views/LoginView.vue"), meta: { public: true } },
  { path: "/register", name: "register", component: () => import("@/views/RegisterView.vue"), meta: { public: true } },
  { path: "/", redirect: "/dashboard" },
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
    path: "/wells", name: "wells",
    component: () => import("@/views/WellsView.vue"),
    meta: { label: "บ่อบาดาล", icon: "mdi-layers-outline" },
  },
  {
    path: "/wells/:id", name: "well-detail",
    component: () => import("@/views/WellDetailView.vue"),
    props: true,
    meta: { hidden: true },
  },
  {
    path: "/warranty", name: "warranty",
    component: () => import("@/views/WarrantyView.vue"),
    meta: { label: "ประกัน 2 ปี", icon: "mdi-shield-check-outline" },
  },
  {
    path: "/maintenance", name: "maintenance",
    component: () => import("@/views/MaintenanceView.vue"),
    meta: { label: "ซ่อมบำรุง", icon: "mdi-tools" },
  },
  {
    path: "/map", name: "map",
    component: () => import("@/views/MapView.vue"),
    meta: { label: "แผนที่", icon: "mdi-map-marker-outline" },
  },
  {
    path: "/customers", name: "customers",
    component: () => import("@/views/CustomersView.vue"),
    meta: { label: "ลูกค้า", icon: "mdi-account-group-outline" },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem("dgwm-token");
  if (!to.meta.public && !token) {
    return next("/login");
  }
  if ((to.name === "login" || to.name === "register") && token) {
    return next("/dashboard");
  }
  next();
});
