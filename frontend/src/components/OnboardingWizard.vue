<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();
const router = useRouter();

const props = defineProps<{ channelId?: string | null }>();
const emit = defineEmits<{ done: [] }>();

const step = ref(1);
const totalSteps = 4;

const steps = [
  {
    title: "สร้าง LINE Official Account",
    icon: "mdi-message-text-outline",
    items: [
      "ไปที่ <strong>LINE Official Account Manager</strong> → สร้างบัญชีใหม่",
      "เลือก <strong>ธุรกิจ</strong> เป็นประเภทบัญชี",
      "ตั้งชื่อบัญชี เช่น <code>ชื่อร้าน-เจาะบ่อ</code>",
      "บันทึก <strong>ชื่อผู้ใช้ (@xxx)</strong> เก็บไว้",
    ],
    tip: "ถ้ามี LINE OA อยู่แล้วข้ามขั้นตอนนี้ได้",
  },
  {
    title: "เปิดใช้ Messaging API",
    icon: "mdi-api",
    items: [
      "ไปที่ <strong>LIVE Official Account Manager</strong> → <strong>Messaging API</strong>",
      "เปิดใช้ <strong>Messaging API</strong>",
      "คัดลอก <strong>Channel ID</strong> (ตัวอย่าง: Uxxxxxxxxxx)",
      "ไปที่ <strong>Channel Access Token</strong> → กด <strong>Issue</strong> → คัดลอกเก็บไว้",
    ],
    tip: "Channel Secret อยู่ที่ LINE Developers Console → Basic settings",
  },
  {
    title: "สร้าง LIFF App",
    icon: "mdi-cellphone-link",
    items: [
      "ไปที่ <strong>LINE Developers Console</strong> (developers.line.me)",
      "สร้าง <strong>Provider</strong> ใหม่ (ชื่ออะไรก็ได้)",
      "สร้าง <strong>Channel</strong> ประเภท <strong>Messaging API</strong>",
      "ไป tab <strong>LIFF</strong> → กด <strong>Add</strong>",
      "ตั้ง <strong>App name</strong> เช่น ฟอร์มแจ้งเจาะ",
      "ตั้ง <strong>Endpoint URL</strong> = <code>https://well-drilling.vercel.app</code>",
      "เลือก Scope = <strong>profile</strong> + <strong>openid</strong>",
      "คัดลอก <strong>LIFF ID</strong> (ตัวอย่าง: 2011510067-xxxxx)",
      "ทำซ้ำอีกครั้งสำหรับ <strong>ฟอร์มแจ้งซ่อม</strong> (สร้าง LIFF App ที่ 2)",
    ],
    tip: "ต้องสร้าง 2 LIFF App: หนึ่งสำหรับแจ้งเจาะ อีกหนึ่งสำหรับแจ้งซ่อม",
  },
  {
    title: "กรอกข้อมูลในระบบ",
    icon: "mdi-cog-outline",
    items: [
      "ไปที่ <strong>ตั้งค่าระบบ</strong> ในเมนูซ้าย",
      "กรอก <strong>Channel ID</strong> จากขั้นตอนที่ 2",
      "กรอก <strong>Channel Secret</strong> จาก LINE Developers Console",
      "กรอก <strong>Channel Access Token</strong> จากขั้นตอนที่ 2",
      "กรอก <strong>LIFF ID (ฟอร์มแจ้งเจาะ)</strong> จากขั้นตอนที่ 3",
      "กรอก <strong>LIFF ID (ฟอร์มแจ้งซ่อม)</strong> จากขั้นตอนที่ 3",
      "กด <strong>บันทึกการตั้งค่า</strong>",
    ],
    tip: "หลังบันทึก ระบบจะแสดง URL สำหรับ Rich Menu ให้อัตโนมัติ",
  },
];

const progress = computed(() => Math.round((step.value / totalSteps) * 100));

function next() {
  if (step.value < totalSteps) step.value++;
}

function prev() {
  if (step.value > 1) step.value--;
}

function skip() {
  localStorage.setItem("onboarding-done", "1");
  emit("done");
}

function finish() {
  localStorage.setItem("onboarding-done", "1");
  router.push("/settings");
  emit("done");
}

function copyText(text: string) {
  navigator.clipboard.writeText(text);
  ui.notify("คัดลอกแล้ว", "success");
}
</script>

<template>
  <v-dialog :model-value="true" max-width="640" persistent>
    <v-card rounded="xl">
      <v-card-title class="d-flex align-center pa-4 pb-2">
        <v-icon icon="mdi-rocket-launch-outline" color="primary" class="mr-2" />
        <span class="text-h6 font-weight-bold">เริ่มต้นใช้งานระบบ</span>
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
          v-if="step === 4 && !props.channelId"
          type="warning"
          variant="tonal"
          density="compact"
          rounded="lg"
          class="mb-3"
        >
          <div class="text-body-2">
            <strong>ยังไม่ได้กรอกข้อมูล LINE</strong> — กรุณากรอกข้อมูลที่หน้าตั้งค่า系统หลังจากทำ wizard เสร็จ
          </div>
        </v-alert>

        <v-alert
          v-if="step === 4 && props.channelId"
          type="success"
          variant="tonal"
          density="compact"
          rounded="lg"
          class="mb-3"
        >
          <div class="text-body-2">
            <strong>พบข้อมูล LINE OA แล้ว!</strong> — ข้อมูลถูกบันทึกในระบบเรียบร้อย
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
  color: #333;
}
.step-list code {
  background: #f0f0f0;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 13px;
}
</style>
