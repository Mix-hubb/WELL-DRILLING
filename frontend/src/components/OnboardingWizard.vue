<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const router = useRouter();

const props = defineProps<{ channelId?: string | null; orgId?: string | null }>();
const emit = defineEmits<{ done: [] }>();

const step = ref(1);
const totalSteps = 5;

const BASE_API = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/api$/, "");
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

const steps = [
  {
    title: "สร้าง LINE Official Account",
    icon: "mdi-message-text-outline",
    items: [
      "ไปที่ <strong>LINE Official Account Manager</strong> (manager.line.biz) → สร้างบัญชีใหม่",
      "เลือก <strong>ธุรกิจ</strong> หรือประเภทบัญชีที่ต้องการ",
      "ตั้งชื่อบัญชี เช่น <code>ชื่อร้าน-เจาะน้ำบาดาล</code>",
      "บันทึก <strong>Basic ID (@xxx)</strong> เก็บไว้ใช้งาน",
    ],
    tip: "หากมี LINE OA สำหรับร้านอยู่แล้ว สามารถใช้บัญชีเดิมได้เลย",
  },
  {
    title: "เปิดใช้ Messaging API",
    icon: "mdi-api",
    items: [
      "ใน LINE Official Account Manager ไปที่ <strong>ตั้งค่า</strong> (รูปฟันเฟืองขวาบน) → <strong>Messaging API</strong>",
      "กด <strong>เปิดใช้ Messaging API</strong> และเลือกหรือสร้าง Provider",
      "คัดลอก <strong>Channel ID</strong> และ <strong>Channel Secret</strong>",
      "ไปที่ <strong>Channel Access Token (Long-lived)</strong> → กด <strong>Issue</strong> เพื่อสร้าง Token แล้วคัดลอกเก็บไว้",
    ],
    tip: "สามารถดูค่าทั้งหมดได้ที่ LINE Developers Console (developers.line.biz) ใน Channel ของ Messaging API",
  },
  {
    title: "สร้าง LINE Login Channel & LIFF Apps",
    icon: "mdi-cellphone-link",
    items: [
      "ไปที่ <strong>LINE Developers Console</strong> → ภายใต้ Provider เดิม กด <strong>Create a new channel</strong>",
      "เลือก Channel Type เป็น <strong>LINE Login</strong> (ตั้งชื่อ เช่น <code>Well-Drilling-Login</code>)",
      "เข้าไปใน Channel LINE Login ที่เพิ่งสร้าง → ไปที่แท็บ <strong>LIFF</strong> → กด <strong>Add</strong>",
      `<strong>LIFF ตัวที่ 1 (แจ้งเจาะ):</strong><br/>• Size: Full หรือ Tall<br/>• Endpoint URL: <code>${APP_URL}/request-drill?liffId=ใส่LIFF_ID_ของตัวนี้</code><br/>• Scopes: ติ๊ก <strong>profile</strong> และ <strong>openid</strong><br/>• กด Add แล้วคัดลอก <strong>LIFF ID</strong> (เช่น 2011510067-xxxxxx)`,
      `<strong>LIFF ตัวที่ 2 (แจ้งซ่อม):</strong><br/>• กด Add เพิ่มอีก 1 ตัว<br/>• Endpoint URL: <code>${APP_URL}/repair-form?liffId=ใส่LIFF_ID_ของตัวนี้</code><br/>• Scopes: ติ๊ก <strong>profile</strong> และ <strong>openid</strong><br/>• กด Add แล้วคัดลอก <strong>LIFF ID</strong>`,
    ],
    tip: "Endpoint URL ต้องระบุ ?liffId= ให้ตรงกับ LIFF ID ของตัวนั้นๆ เพื่อให้ระบบเชื่อมต่ออัตโนมัติ",
  },
  {
    title: "กรอกข้อมูลในหน้าตั้งค่าระบบ",
    icon: "mdi-cog-outline",
    items: [
      "ไปที่เมนู <strong>ตั้งค่าระบบ</strong> ของเว็บไซต์นี้",
      "กรอก <strong>Channel ID</strong>, <strong>Channel Secret</strong> และ <strong>Channel Access Token</strong>",
      "กรอก <strong>LIFF ID (ฟอร์มแจ้งเจาะ)</strong> และ <strong>LIFF ID (ฟอร์มแจ้งซ่อม)</strong>",
      "กดปุ่ม <strong>บันทึกการตั้งค่า</strong> (ระบบจะตรวจสอบและผูกกับองค์กรนี้ให้ทันที)",
    ],
    tip: "หากเคยนำ Bot นี้ไปทดสอบในองค์กรอื่น ระบบจะย้ายการผูกมายังองค์กรนี้ให้อัตโนมัติ",
  },
  {
    title: "ตั้งค่า Webhook & Rich Menu ใน LINE",
    icon: "mdi-check-decagram-outline",
    items: [
      `<strong>1. Webhook URL:</strong><br/>นำ URL <code>${BASE_API}/api/webhooks/line</code> ไปวางที่ LINE Developers Console → Messaging API → Webhook URL แล้วกดเปิด <strong>Use Webhook</strong>`,
      "<strong>2. Rich Menu (เมนูลัดในห้องแชท):</strong><br/>ไปที่ LINE Official Account Manager → ริชเมนู (Rich Menu) → สร้างเมนู",
      "• ปุ่มแจ้งเจาะ: Action เลือก <strong>ลิงก์ (Open URL)</strong> → ใส่ <code>https://liff.line.me/LIFF_ID_แจ้งเจาะ</code>",
      "• ปุ่มแจ้งซ่อม: Action เลือก <strong>ลิงก์ (Open URL)</strong> → ใส่ <code>https://liff.line.me/LIFF_ID_แจ้งซ่อม</code>",
    ],
    tip: "ลิงก์ Rich Menu ใช้แค่ https://liff.line.me/{LIFF_ID} โดยตรง ไม่ต้องต่อท้าย path ใดๆ เพราะ LINE จะเปิด Endpoint URL ให้อัตโนมัติ",
  },
];

const progress = computed(() => Math.round((step.value / totalSteps) * 100));

function next() {
  if (step.value < totalSteps) step.value++;
}

function prev() {
  if (step.value > 1) step.value--;
}

function markOnboardingDone() {
  const orgKey = props.orgId || "default";
  localStorage.setItem(`onboarding-done-${orgKey}`, "1");
  localStorage.setItem("onboarding-done", "1");
}

function skip() {
  markOnboardingDone();
  emit("done");
}

function finish() {
  markOnboardingDone();
  router.push("/settings");
  emit("done");
}
</script>

<template>
  <v-dialog :model-value="true" max-width="680" persistent>
    <v-card rounded="xl">
      <v-card-title class="d-flex align-center pa-4 pb-2">
        <v-icon icon="mdi-rocket-launch-outline" color="primary" class="mr-2" />
        <span class="text-h6 font-weight-bold">คู่มือการเชื่อมต่อ LINE ระบบจัดการบ่อบาดาล</span>
        <v-spacer />
        <v-btn icon="mdi-close" variant="text" size="small" @click="skip" />
      </v-card-title>

      <v-card-text class="px-4 pt-0">
        <v-progress-linear :model-value="progress" color="primary" rounded class="mb-4" />

        <div class="text-caption text-medium-emphasis mb-3">
          ขั้นตอนที่ {{ step }} / {{ totalSteps }} — {{ steps[step - 1].title }}
        </div>

        <v-card variant="tonal" rounded="lg" class="mb-3">
          <v-card-text>
            <div class="d-flex align-center mb-3">
              <v-icon :icon="steps[step - 1].icon" size="24" color="primary" class="mr-2" />
              <span class="text-subtitle-1 font-weight-bold">{{ steps[step - 1].title }}</span>
            </div>

            <ol class="step-list">
              <li v-for="(item, i) in steps[step - 1].items" :key="i" class="mb-2">
                <span v-html="item" />
              </li>
            </ol>

            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              rounded="lg"
              class="mt-3 mb-0"
              icon="mdi-lightbulb-outline"
            >
              <span class="text-body-2">{{ steps[step - 1].tip }}</span>
            </v-alert>
          </v-card-text>
        </v-card>

        <v-alert
          v-if="step === totalSteps && props.channelId"
          type="success"
          variant="tonal"
          density="compact"
          rounded="lg"
          class="mb-3"
        >
          <div class="text-body-2">
            <strong>ระบบนี้ตั้งค่า LINE เรียบร้อยแล้ว!</strong> — หากต้องการเปลี่ยนบอท สามารถอัปเดตข้อมูลได้ที่หน้าตั้งค่า
          </div>
        </v-alert>
      </v-card-text>

      <v-card-actions class="pa-4 pt-0">
        <v-btn v-if="step > 1" variant="text" @click="prev">
          <v-icon start icon="mdi-arrow-left" />
          ย้อนกลับ
        </v-btn>
        <v-spacer />
        <v-btn variant="text" color="grey" @click="skip">ข้าม</v-btn>
        <v-btn
          v-if="step < totalSteps"
          color="primary"
          rounded="lg"
          @click="next"
        >
          ถัดไป
          <v-icon end icon="mdi-arrow-right" />
        </v-btn>
        <v-btn
          v-else
          color="primary"
          rounded="lg"
          @click="finish"
        >
          <v-icon start icon="mdi-cog-outline" />
          ไปตั้งค่าระบบ
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.step-list {
  padding-left: 20px;
  margin: 0;
}
.step-list li {
  font-size: 14px;
  line-height: 1.6;
  color: rgb(var(--v-theme-on-surface));
}
.step-list code {
  background: rgb(var(--v-theme-surface-variant));
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 13px;
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
