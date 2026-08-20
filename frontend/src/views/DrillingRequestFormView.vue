<script setup lang="ts">
import { ref, onMounted } from "vue";
import liff from "@line/liff";

const form = ref({
  name: "",
  phone: "",
  address: "",
  requested_depth_m: null as number | null,
});

const loading = ref(false);
const success = ref(false);
const error = ref("");
const lineUserId = ref<string | null>(null);
const liffReady = ref(false);
const isLiffEnv = ref(false);
const isLoggedIn = ref(false);
const profileName = ref("");

onMounted(async () => {
  const liffId = import.meta.env.VITE_LIFF_ID_DRILLING || "";
  if (!liffId) {
    liffReady.value = true;
    return;
  }
  try {
    isLiffEnv.value = true;
    await liff.init({ liffId });
    if (liff.isLoggedIn()) {
      const profile = await liff.getProfile();
      lineUserId.value = profile?.userId || null;
      profileName.value = profile?.displayName || "";
      isLoggedIn.value = true;
    }
  } catch (e) {
    console.warn("LIFF init error:", e);
  } finally {
    liffReady.value = true;
  }
});

function loginWithLine() {
  liff.login();
}

async function submit() {
  if (!form.value.name || !form.value.phone || !form.value.address || !form.value.requested_depth_m) {
    error.value = "กรุณากรอกข้อมูลให้ครบทุกช่อง";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";
    const res = await fetch(`${BASE_URL}/public/drilling-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.value.name,
        phone: form.value.phone,
        address: form.value.address,
        requested_depth_m: form.value.requested_depth_m ? Number(form.value.requested_depth_m) : null,
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
          <v-icon icon="mdi-water-well" size="40" color="primary" />
        </div>
        <div class="text-h5 font-weight-bold" style="color: #2E2418;">แจ้งเจาะบ่อบาดาล</div>
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

      <!-- Login with LINE -->
      <div v-else-if="isLiffEnv && !isLoggedIn" class="form-card" style="text-align: center; padding: 48px 24px;">
        <div class="header-icon" style="margin-bottom: 20px;">
          <v-icon icon="mdi-login" size="40" color="primary" />
        </div>
        <div class="text-h6 font-weight-bold mb-2" style="color: #2E2418;">เข้าสู่ระบบด้วย LINE</div>
        <div class="text-body-2 mb-6" style="color: #6A7A8A;">
          กดปุ่มด้านล่างเพื่อเข้าสู่ระบบด้วยบัญชี LINE ของคุณ
        </div>
        <v-btn
          color="#06C755"
          size="x-large"
          rounded="lg"
          elevation="0"
          class="submit-btn"
          @click="loginWithLine"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" class="mr-2" style="fill: white;">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          เข้าสู่ระบบด้วย LINE
        </v-btn>
      </div>

      <!-- Form State -->
      <div v-else-if="isLoggedIn" class="form-card">
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
              เบอร์โทรที่สามารถติดต่อได้
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
              ที่อยู่ (ที่ต้องการขุดบ่อบาดาล)
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

          <!-- ความลึก -->
          <div class="field-group">
            <div class="field-label">
              <v-icon icon="mdi-ruler" size="16" class="mr-1" />
              ความลึกของบ่อน้ำบาดาลที่ต้องการ (เมตร)
              <span class="text-error ml-1">*</span>
            </div>
            <v-text-field
              v-model="form.requested_depth_m"
              type="number"
              placeholder="เช่น 80"
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
            :disabled="!form.name || !form.phone || !form.address || !form.requested_depth_m"
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
