<script setup lang="ts">
import { ref, onMounted } from "vue";
import liff from "@line/liff";

const form = ref({
  name: "",
  phone: "",
  address: "",
  problems: "",
});

const loading = ref(false);
const success = ref(false);
const error = ref("");
const lineUserId = ref<string | null>(null);
const liffReady = ref(false);
const isLiffEnv = ref(false);

onMounted(async () => {
  const liffId = import.meta.env.VITE_LIFF_ID_REPAIR || "";
  if (!liffId) {
    liffReady.value = true;
    return;
  }
  try {
    isLiffEnv.value = true;
    await liff.init({ liffId });
    if (!liff.isLoggedIn()) {
      liff.login();
      return;
    }
    const profile = await liff.getProfile();
    lineUserId.value = profile?.userId || null;
  } catch (e) {
    console.warn("LIFF init error:", e);
  } finally {
    liffReady.value = true;
  }
});

async function submit() {
  if (!form.value.name || !form.value.phone || !form.value.problems) {
    error.value = "กรุณากรอกข้อมูลให้ครบทุกช่อง";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";
    const res = await fetch(`${BASE_URL}/public/repair-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:    form.value.name,
        phone:   form.value.phone,
        address: form.value.address || null,
        problems: [form.value.problems],
        detail:  null,
        line_user_id: lineUserId.value || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    success.value = true;
    if (isLiffEnv.value) {
      setTimeout(() => { liff.closeWindow(); }, 3000);
    }
  } catch (e: any) {
    error.value = e.message || "เกิดข้อผิดพลาด";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page-bg">
    <div class="form-container">
      <!-- Header -->
      <div class="form-header">
        <div class="header-icon">
          <v-icon icon="mdi-wrench-outline" size="40" color="primary" />
        </div>
        <div class="text-h5 font-weight-bold" style="color: #2E2418;">แจ้งซ่อมบ่อบาดาล</div>
        <div class="text-caption mt-1" style="color: #6A7A8A;">กรอกข้อมูลเพื่อให้ทีมงานติดต่อกลับ</div>
      </div>

      <!-- Success State -->
      <div v-if="success" class="success-card">
        <div class="success-icon-wrapper">
          <v-icon icon="mdi-check-circle" size="64" color="success" />
        </div>
        <div class="text-h6 font-weight-bold mb-2" style="color: #2E2418;">กรอกข้อมูลสำเร็จ</div>
        <div class="text-body-2" style="color: #6A7A8A;">
          เราได้รับคำร้องของคุณแล้ว<br />
          กรุณารอการตอบกลับจากทีมงาน
        </div>
      </div>

      <!-- Loading LIFF -->
      <div v-if="!liffReady" class="form-card" style="text-align: center; padding: 48px 24px;">
        <v-progress-circular indeterminate color="primary" size="48" />
        <div class="text-body-2 mt-4" style="color: #6A7A8A;">กำลังเชื่อมต่อ...</div>
      </div>

      <!-- Form State -->
      <div v-else class="form-card">
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-4"
          rounded="lg"
        >{{ error }}</v-alert>

        <v-form @submit.prevent="submit">
          <!-- ชื่อ-นามสกุล -->
          <div class="field-group">
            <div class="field-label">
              <v-icon icon="mdi-account-outline" size="16" class="mr-1" />
              ชื่อ-นามสกุล
            </div>
            <v-text-field
              v-model="form.name"
              placeholder="กรอกชื่อ-นามสกุล"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              hide-details
              class="field-input"
            />
          </div>

          <!-- เบอร์โทร -->
          <div class="field-group">
            <div class="field-label">
              <v-icon icon="mdi-phone-outline" size="16" class="mr-1" />
              เบอร์โทรศัพท์ที่สามารถติดต่อได้
            </div>
            <v-text-field
              v-model="form.phone"
              placeholder="กรอกเบอร์โทรศัพท์"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              hide-details
              class="field-input"
            />
          </div>

          <!-- ที่อยู่ -->
          <div class="field-group">
            <div class="field-label">
              <v-icon icon="mdi-map-marker-outline" size="16" class="mr-1" />
              ที่อยู่ (ที่ต้องการให้เข้าไปซ่อม)
              <span class="text-error ml-1">*</span>
            </div>
            <v-text-field
              v-model="form.address"
              placeholder="กรอกที่อยู่"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              hide-details
              class="field-input"
            />
          </div>

          <!-- อาการที่พบ -->
          <div class="field-group">
            <div class="field-label">
              <v-icon icon="mdi-alert-circle-outline" size="16" class="mr-1" />
              อาการที่พบ
              <span class="text-error ml-1">*</span>
            </div>
            <v-text-field
              v-model="form.problems"
              placeholder="เช่น ไม่มีน้ำ, น้ำไหลอ่อน, ปั๊มเสีย"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              hide-details
              class="field-input"
            />
          </div>

          <!-- Submit Button -->
          <v-btn
            type="submit"
            color="primary"
            block
            size="x-large"
            :loading="loading"
            :disabled="!form.name || !form.phone || !form.problems"
            rounded="lg"
            class="mt-2 submit-btn"
            elevation="0"
          >
            <v-icon icon="mdi-send-outline" class="mr-2" />
            ส่งคำร้อง
          </v-btn>
        </v-form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page-bg {
  min-height: 100vh;
  background: #F0EAE0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 32px 16px;
}

.form-container {
  width: 100%;
  max-width: 480px;
}

.form-header {
  text-align: center;
  margin-bottom: 24px;
}

.header-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #F7F3EB;
  border: 2px solid #E6DDD1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.form-card {
  background: #F7F3EB;
  border: 1px solid #E6DDD1;
  border-radius: 16px;
  padding: 28px 24px;
}

.field-group {
  margin-bottom: 20px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #2E2418;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
}

.field-input {
  font-size: 15px;
}

.submit-btn {
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: none;
  font-size: 15px;
  height: 52px !important;
}

.success-card {
  background: #F7F3EB;
  border: 1px solid #E6DDD1;
  border-radius: 16px;
  padding: 48px 24px;
  text-align: center;
}

.success-icon-wrapper {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: #E8F5E9;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}
</style>
