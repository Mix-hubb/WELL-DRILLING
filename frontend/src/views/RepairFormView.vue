<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import liff from "@line/liff";

const form = ref({
  name: "",
  phone: "",
  address: "",
  problem_types: [] as string[],
  detail: "",
  scheduled_date: "",
});

const loading = ref(false);
const success = ref(false);
const error = ref("");
const lineUserId = ref<string | null>(null);
const liffReady = ref(false);
const isLiffEnv = ref(false);
const isLoggedIn = ref(false);
const profileName = ref("");
const profilePicture = ref("");
const customerFound = ref(false);
const checkingExisting = ref(false);

const photos = ref<File[]>([]);
const photoPreview = ref<string[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

const problemOptions = [
  "ไม่มีน้ำใช้",
  "น้ำไหลอ่อน",
  "น้ำไม่ไหลเลย",
  "น้ำขุ่น / น้ำสกปรก",
  "น้ำมีกลิ่น / น้ำมีสี",
  "ปั๊มน้ำเสีย / ไม่ทำงาน",
  "ปั๊มน้ำสั่น / มีเสียงดัง",
  "ไฟดับ / ไฟช็อต",
  "ท่อแตก / ท่อรั่ว",
  "ท่อตัน",
  "สตาร์ทไม่ติด",
  "สายไฟเสียหาย",
  "หน้าปัด / สwitch เสีย",
  "ต้องการย้ายตำแหน่งปั๊ม",
  "อื่นๆ",
];

function toggleProblem(p: string) {
  const idx = form.value.problem_types.indexOf(p);
  if (idx >= 0) {
    form.value.problem_types.splice(idx, 1);
  } else {
    form.value.problem_types.push(p);
  }
}

function onFileSelect(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files) return;
  const files = Array.from(input.files);
  const remaining = 5 - photos.value.length;
  const toAdd = files.slice(0, remaining);

  for (const f of toAdd) {
    if (f.size > 5 * 1024 * 1024) {
      error.value = `ไฟล์ ${f.name} มีขนาดเกิน 5MB`;
      return;
    }
    photos.value.push(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      photoPreview.value.push(ev.target?.result as string);
    };
    reader.readAsDataURL(f);
  }
  input.value = "";
}

function removePhoto(idx: number) {
  photos.value.splice(idx, 1);
  photoPreview.value.splice(idx, 1);
}

function resizeImage(file: File, maxW = 800): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > maxW) {
          h = (h * maxW) / w;
          w = maxW;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const canSubmit = computed(() => {
  return form.value.problem_types.length > 0;
});

async function submit() {
  if (form.value.problem_types.length === 0) {
    error.value = "กรุณาเลือกอาการที่พบอย่างน้อย 1 รายการ";
    return;
  }
  loading.value = true;
  error.value = "";
  try {
    let photoData: string[] = [];
    if (photos.value.length > 0) {
      photoData = await Promise.all(photos.value.map((f) => resizeImage(f)));
    }

    const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";
    const res = await fetch(`${BASE_URL}/public/repair-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.value.name,
        phone: form.value.phone,
        address: form.value.address || null,
        problems: form.value.problem_types,
        detail: form.value.detail || null,
        photos: photoData.length > 0 ? photoData : null,
        scheduled_date: form.value.scheduled_date || null,
        line_user_id: lineUserId.value || null,
        line_display_name: profileName.value || null,
        line_picture_url: profilePicture.value || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    success.value = true;
  } catch (e: any) {
    error.value = e.message || "เกิดข้อผิดพลาด";
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  const liffId = import.meta.env.VITE_LIFF_ID_REPAIR || "";
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
      profilePicture.value = profile?.pictureUrl || "";
      isLoggedIn.value = true;
      await checkExistingCustomer();
    }
  } catch (e) {
    console.warn("LIFF init error:", e);
  } finally {
    liffReady.value = true;
  }
});

async function checkExistingCustomer() {
  if (!lineUserId.value) return;
  checkingExisting.value = true;
  try {
    const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4001/api";
    const res = await fetch(`${BASE_URL}/public/customer-by-line?line_user_id=${encodeURIComponent(lineUserId.value)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.found && data.customer && data.customer.phone) {
      customerFound.value = true;
      form.value.name = data.customer.customer_name || profileName.value;
      form.value.phone = data.customer.phone || "";
      form.value.address = data.customer.address || "";
    } else {
      form.value.name = profileName.value;
    }
  } catch {
    form.value.name = profileName.value;
  } finally {
    checkingExisting.value = false;
  }
}

function loginWithLine() {
  liff.login();
}
</script>

<template>
  <div class="page-bg">
    <div class="form-container">
      <div class="form-header">
        <div class="header-icon">
          <v-icon icon="mdi-wrench-outline" size="40" color="primary" />
        </div>
        <div class="text-h5 font-weight-bold" style="color: #2E2418;">แจ้งซ่อมบ่อบาดาล</div>
        <div class="text-caption mt-1" style="color: #6A7A8A;">เลือกรายละเอียดปัญหาเพื่อให้ทีมงานเข้าซ่อม</div>
      </div>

      <!-- Success -->
      <div v-if="success" class="success-card">
        <div class="success-icon-wrapper">
          <v-icon icon="mdi-check-circle" size="64" color="success" />
        </div>
        <div class="text-h6 font-weight-bold mb-2" style="color: #2E2418;">ส่งคำร้องสำเร็จ</div>
        <div class="text-body-2" style="color: #6A7A8A;">
          เราได้รับคำร้องซ่อมของคุณแล้ว<br />
          กรุณารอการตอบกลับจากทีมงาน
        </div>
      </div>

      <!-- Loading LIFF -->
      <div v-if="!success && !liffReady" class="form-card" style="text-align: center; padding: 48px 24px;">
        <v-progress-circular indeterminate color="primary" size="48" />
        <div class="text-body-2 mt-4" style="color: #6A7A8A;">กำลังเชื่อมต่อ...</div>
      </div>

      <!-- Login with LINE -->
      <div v-else-if="!success && isLiffEnv && !isLoggedIn" class="form-card" style="text-align: center; padding: 48px 24px;">
        <div class="header-icon" style="margin-bottom: 20px;">
          <v-icon icon="mdi-login" size="40" color="primary" />
        </div>
        <div class="text-h6 font-weight-bold mb-2" style="color: #2E2418;">เข้าสู่ระบบด้วย LINE</div>
        <div class="text-body-2 mb-6" style="color: #6A7A8A;">
          กดปุ่มด้านล่างเพื่อเข้าสู่ระบบด้วยบัญชี LINE ของคุณ
        </div>
        <v-btn color="#06C755" size="x-large" rounded="lg" elevation="0" class="submit-btn" @click="loginWithLine">
          <svg viewBox="0 0 24 24" width="24" height="24" class="mr-2" style="fill: white;">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          เข้าสู่ระบบด้วย LINE
        </v-btn>
      </div>

      <!-- Checking existing -->
      <div v-else-if="!success && isLoggedIn && checkingExisting" class="form-card" style="text-align: center; padding: 48px 24px;">
        <v-progress-circular indeterminate color="primary" size="48" />
        <div class="text-body-2 mt-4" style="color: #6A7A8A;">กำลังตรวจสอบข้อมูล...</div>
      </div>

      <!-- Form -->
      <div v-else-if="!success && isLoggedIn" class="form-card">
        <v-alert v-if="error" type="error" variant="tonal" density="compact" class="mb-4" rounded="lg">
          {{ error }}
        </v-alert>

        <!-- แสดงข้อมูลลูกค้าอัตโนมัติ -->
        <v-alert v-if="customerFound" type="info" variant="tonal" density="compact" rounded="lg" class="mb-4">
          <div class="text-body-2"><strong>{{ form.name }}</strong></div>
          <div v-if="form.phone" class="text-caption">{{ form.phone }}</div>
          <div v-if="form.address" class="text-caption">{{ form.address }}</div>
        </v-alert>

        <v-form @submit.prevent="submit">

          <!-- อาการที่พบ -->
          <div class="field-group">
            <div class="field-label">
              <v-icon icon="mdi-alert-circle-outline" size="16" class="mr-1" />
              อาการที่พบ
              <span class="text-error ml-1">*</span>
            </div>
            <div class="chip-grid">
              <v-chip
                v-for="p in problemOptions"
                :key="p"
                :color="form.problem_types.includes(p) ? 'primary' : 'default'"
                :variant="form.problem_types.includes(p) ? 'flat' : 'outlined'"
                size="small"
                class="problem-chip"
                @click="toggleProblem(p)"
              >
                <v-icon v-if="form.problem_types.includes(p)" start icon="mdi-check" size="14" />
                {{ p }}
              </v-chip>
            </div>
          </div>

          <!-- รายละเอียดเพิ่มเติม -->
          <div class="field-group">
            <div class="field-label">
              <v-icon icon="mdi-text-box-outline" size="16" class="mr-1" />
              รายละเอียดเพิ่มเติม
            </div>
            <v-textarea
              v-model="form.detail"
              placeholder="อธิบายอาการเพิ่มเติม เช่น เป็นมานานแค่ไหน เคยซ่อมมาก่อนไหม"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              hide-details
              rows="3"
              auto-grow
              class="field-input"
            />
          </div>

          <!-- แนบรูปภาพ -->
          <div class="field-group">
            <div class="field-label">
              <v-icon icon="mdi-camera-outline" size="16" class="mr-1" />
              แนบรูปภาพ (สูงสุด 5 รูป)
            </div>
            <div class="photo-grid">
              <div v-for="(src, idx) in photoPreview" :key="idx" class="photo-item">
                <img :src="src" />
                <v-btn icon size="x-small" color="error" class="photo-remove" @click="removePhoto(idx)">
                  <v-icon size="14">mdi-close</v-icon>
                </v-btn>
              </div>
              <div
                v-if="photos.length < 5"
                class="photo-add"
                @click="fileInput?.click()"
              >
                <v-icon icon="mdi-camera-plus-outline" size="28" color="#6A7A8A" />
                <div class="text-caption" style="color: #6A7A8A;">เพิ่มรูป</div>
              </div>
            </div>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              style="display: none;"
              @change="onFileSelect"
            />
          </div>

          <div class="field-group">
            <div class="field-label">
              <v-icon icon="mdi-calendar-clock-outline" size="16" class="mr-1" />
              วันที่สะดวกรับบริการ
            </div>
            <v-text-field
              v-model="form.scheduled_date"
              type="date"
              :min="new Date(Date.now() + 86400000).toISOString().split('T')[0]"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              hide-details
              class="field-input"
            />
          </div>

          <!-- Submit -->
          <v-btn
            type="submit"
            color="primary"
            block
            size="x-large"
            :loading="loading"
            :disabled="!canSubmit"
            rounded="lg"
            class="mt-2 submit-btn"
            elevation="0"
          >
            <v-icon icon="mdi-send-outline" class="mr-2" />
            ส่งคำร้องซ่อม
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
.form-container { width: 100%; max-width: 480px; }
.form-header { text-align: center; margin-bottom: 24px; }
.header-icon {
  width: 72px; height: 72px; border-radius: 50%;
  background: #F7F3EB; border: 2px solid #E6DDD1;
  display: inline-flex; align-items: center; justify-content: center;
  margin-bottom: 16px;
}
.form-card {
  background: #F7F3EB; border: 1px solid #E6DDD1;
  border-radius: 16px; padding: 28px 24px;
}
.field-group { margin-bottom: 20px; }
.field-label {
  font-size: 13px; font-weight: 600; color: #2E2418;
  margin-bottom: 8px; display: flex; align-items: center;
}
.field-input { font-size: 15px; }
.submit-btn {
  font-weight: 600; letter-spacing: 0.5px; text-transform: none;
  font-size: 15px; height: 52px !important;
}
.success-card {
  background: #F7F3EB; border: 1px solid #E6DDD1;
  border-radius: 16px; padding: 48px 24px; text-align: center;
}
.success-icon-wrapper {
  width: 96px; height: 96px; border-radius: 50%;
  background: #E8F5E9; display: inline-flex;
  align-items: center; justify-content: center; margin-bottom: 16px;
}
.chip-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.problem-chip {
  cursor: pointer;
  transition: all 0.15s;
}
.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.photo-item {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  border: 1px solid #E6DDD1;
}
.photo-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-remove {
  position: absolute;
  top: 2px;
  right: 2px;
}
.photo-add {
  width: 80px;
  height: 80px;
  border-radius: 12px;
  border: 2px dashed #E6DDD1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.2s;
}
.photo-add:hover {
  border-color: #4A6278;
}
</style>
