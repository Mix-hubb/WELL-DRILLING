<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

// ============================================================
// Constants
// ============================================================
/** Duration ตอนสไลด์ออก (กด log in) — แหล่งเดียวกับ CSS var `--login-out-duration` */
const EXIT_ANIMATION_MS = 800;

// ============================================================
// Composables / Stores
// ============================================================
const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

// ============================================================
// State
// ============================================================
const email = ref("");
const password = ref("");
const showPassword = ref(false);
const loading = ref(false);
const exiting = ref(false);

const highlights = [
  { icon: "mdi-hammer-wrench", text: "จัดการคิวเจาะและซ่อมในที่เดียว" },
  { icon: "mdi-layers-outline", text: "บันทึกเทคนิคบ่อ: ชั้นดิน ปลอก ท่อ ปั๊ม" },
  { icon: "mdi-shield-check-outline", text: "ติดตามประกัน 2 ปีทุกบ่ออัตโนมัติ" },
];

// ============================================================
// Helpers
// ============================================================
const requiredField = (message: string) => (value: string) => !!value || message;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ============================================================
// Actions
// ============================================================
async function handleLogin() {
  if (exiting.value) return;
  if (!email.value || !password.value) {
    ui.notify("กรุณากรอกอีเมลและรหัสผ่าน", "warning");
    return;
  }

  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    ui.notify("เข้าสู่ระบบสำเร็จ", "success");
    exiting.value = true;
    await sleep(EXIT_ANIMATION_MS);
    router.push("/dashboard");
  } catch (err) {
    ui.notifyError(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <v-container fluid class="fill-height login-wrap pa-0">
    <v-row class="h-100" align="stretch" no-gutters>
      <!-- ===== Hero panel (desktop) ===== -->
      <v-col cols="12" md="7" class="login-hero d-none d-md-flex align-center justify-center">
        <div class="hero-inner">
          <v-avatar rounded="xl" size="72" class="brand-tile hero-logo">
            <v-icon icon="mdi-layers-triple" size="40" />
          </v-avatar>
          <h1 class="text-h3 font-display font-weight-bold hero-title mt-6">
            ระบบจัดการบ่อบาดาล<br />แบบดิจิทัล
          </h1>
          <p class="hero-sub mt-4">
            บันทึกข้อมูลการเจาะ รายงานลูกค้า และติดตามงานทั้งหมด
            ให้มืออาชีพ
          </p>
          <div class="hero-list mt-8">
            <div v-for="h in highlights" :key="h.text" class="hero-item">
              <div class="hero-item-icon">
                <v-icon :icon="h.icon" size="20" />
              </div>
              <span>{{ h.text }}</span>
            </div>
          </div>
        </div>
      </v-col>

      <!-- ===== Form panel ===== -->
      <v-col cols="12" md="5" class="d-flex align-center justify-center login-form-col">
        <v-card
          class="login-card"
          :class="{ 'login-card--out': exiting }"
          :style="{ '--login-out-duration': `${EXIT_ANIMATION_MS}ms` }"
          width="100%"
          max-width="440"
          elevation="8"
        >
          <div class="text-center pt-6 login-card-header">
            <v-avatar rounded="lg" size="52" class="brand-tile d-md-none mb-2">
              <v-icon icon="mdi-layers-triple" size="28" />
            </v-avatar>
            <div class="text-h5 font-weight-bold mt-2">เข้าสู่ระบบ</div>
            <div class="text-body-2 text-medium-emphasis">Well-Drilling</div>
          </div>

          <v-card-text class="pt-6">
            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="email"
                label="อีเมล"
                type="email"
                prepend-inner-icon="mdi-email-outline"
                variant="outlined"
                density="comfortable"
                :rules="[requiredField('กรุณากรอกอีเมล')]"
                class="mb-3"
              />
              <v-text-field
                v-model="password"
                label="รหัสผ่าน"
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                variant="outlined"
                density="comfortable"
                :rules="[requiredField('กรุณากรอกรหัสผ่าน')]"
                class="mb-5"
                @click:append-inner="showPassword = !showPassword"
              />
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                :disabled="exiting"
                rounded="lg"
              >
                เข้าสู่ระบบ
              </v-btn>
            </v-form>
          </v-card-text>

          <v-card-actions class="justify-center pb-6">
            <span class="text-body-2 text-medium-emphasis">ยังไม่มีบัญชี?</span>
            <v-btn variant="text" color="primary" size="small" to="/register">
              ลงทะเบียน
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
/* ============================================================
   Layout
   ============================================================ */
.login-wrap { background: transparent; }
.login-form-col { padding: 24px; }

/* ============================================================
   Hero panel
   ============================================================ */
.login-hero {
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(900px 600px at 20% 10%, rgb(var(--v-theme-primary) / 0.4), transparent 60%),
    radial-gradient(700px 500px at 90% 90%, rgb(var(--v-theme-secondary) / 0.3), transparent 55%),
    linear-gradient(160deg, rgb(var(--v-theme-primary)), rgb(var(--v-theme-primary-darken-1)));
  color: #ffffff;
}
.login-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: linear-gradient(180deg, rgba(0,0,0,0.9), transparent 90%);
  pointer-events: none;
}
.v-theme--dark .login-hero {
  color: rgb(var(--v-theme-on-primary));
  text-shadow: none;
}
.hero-inner { position: relative; z-index: 1; max-width: 520px; padding: 32px; }
.hero-item {
  display: flex;
  align-items: center;
  gap: 14px;
  font-size: 0.98rem;
  text-shadow: 0 1px 6px rgba(0,0,0,0.2);
}
.hero-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255,255,255,0.22);
  border: 1px solid rgba(255,255,255,0.4);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  flex-shrink: 0;
}
.v-theme--dark .hero-item-icon {
  background: rgba(0,0,0,0.08);
  border-color: rgba(0,0,0,0.18);
  box-shadow: none;
}

/* ============================================================
   Login card — half-circle (flat right, curved left)
   ============================================================ */
.login-card {
  /* ระยะเวลาแชร์กับ JS: EXIT_ANIMATION_MS ถูก bind มาทับที่ inline style */
  --login-in-duration: 0.95s;
  --login-out-duration: 0.8s;

  border-radius: 999px 0 0 999px;
  overflow: hidden;
  animation: login-in var(--login-in-duration) cubic-bezier(0.22, 0.61, 0.36, 1) both;
}
.login-card--out {
  animation: login-out var(--login-out-duration) cubic-bezier(0.6, 0.05, 0.28, 1) both;
  pointer-events: none;
}
@keyframes login-in {
  0%   { transform: translateX(76vw); }
  60%  { transform: translateX(-2vw); }
  80%  { transform: translateX(1vw); }
  100% { transform: none; }
}
@keyframes login-out {
  0%   { transform: none; }
  100% { transform: translateX(76vw); }
}
.login-card-header,
.login-card :deep(.v-card-text),
.login-card :deep(.v-card-actions) {
  animation: fadeUp 0.5s 0.45s both;
}

/* ============================================================
   Hero staggered entrance
   ============================================================ */
.hero-logo  { box-shadow: 0 8px 24px rgba(0,0,0,0.25); animation: fadeUp 0.7s 0.05s both; }
.hero-title { line-height: 1.25; text-shadow: 0 2px 12px rgba(0,0,0,0.25); animation: fadeUp 0.7s 0.15s both; }
.hero-sub   { font-size: 1.05rem; text-shadow: 0 1px 8px rgba(0,0,0,0.2); animation: fadeUp 0.7s 0.25s both; }
.hero-list  { display: flex; flex-direction: column; gap: 14px; animation: fadeUp 0.7s 0.35s both; }

/* ============================================================
   Responsive
   ============================================================ */
@media (max-width: 959px) {
  .login-form-col { min-height: 100vh; }
}
</style>
