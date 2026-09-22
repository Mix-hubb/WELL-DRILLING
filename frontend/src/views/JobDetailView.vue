<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { jobsApi }       from "@/api/jobs";
import { api }           from "@/api/client";
import { useUiStore }    from "@/stores/ui";
import { useAuthStore }  from "@/stores/auth";

import { useSSERefresh } from "@/composables/useSSERefresh";
import { useSSE }        from "@/composables/useSSE";
import { fmtDate }       from "@/utils/date";
import type { DrillingJob, DrillingJobStatus } from "@/types";
import { JOB_STATUS, jobDisplayStatus } from "@/constants";
import StatusChip      from "@/components/StatusChip.vue";
import DrillerLinkChip from "@/components/DrillerLinkChip.vue";

const route  = useRoute();
const router = useRouter();
const ui     = useUiStore();
const auth   = useAuthStore();
const job          = ref<DrillingJob | null>(null);
const wellId       = ref<number | null>(null);

// จับค่า id จาก URL ครั้งเดียวตอนเมานต์ ไม่อ่าน route.params.id ซ้ำใน load()
// เพราะ route เป็น reactive object ตัวเดียวที่ใช้ร่วมกันทั้งแอป — ถ้า useSSERefresh
// สั่ง load() ทำงานล่าช้า (เช่น ระหว่าง page transition หลังผู้ใช้กดออกจากหน้านี้ไปแล้ว)
// route.params.id ตอนนั้นอาจเปลี่ยนเป็นของหน้าอื่นไปแล้ว ทำให้เข้าเงื่อนไข "ไม่พบรหัสงาน"
// และ redirect ผู้ใช้กลับ /jobs ทั้งที่ไม่ได้เกิดปัญหาจริงกับคิวงานนี้เลย
const jobId = route.params.id as string | undefined;

const FAILED_STEPS: DrillingJobStatus[] = ["QUEUED", "DRILLING", "FAILED", "CLOSED"];
const SUCCESS_STEPS: DrillingJobStatus[] = ["QUEUED", "DRILLING", "SUCCESS", "CLOSED"];
const STEPS = computed<DrillingJobStatus[]>(() => (
  job.value && jobDisplayStatus(job.value) === "FAILED" ? FAILED_STEPS : SUCCESS_STEPS
));
const currentStepIndex = computed(() => (job.value ? STEPS.value.indexOf(job.value.status as DrillingJobStatus) : 0));

async function load() {
  if (!jobId || jobId === "undefined" || jobId === "null") {
    ui.notify("ไม่พบรหัสงาน กลับไปหน้าคิวงาน", "error");
    router.push("/jobs");
    return;
  }
  try {
    job.value = await jobsApi.getOne(jobId);
    wellId.value = job.value?.well_id ?? null;
  } catch (e) {
    ui.notifyError(e);
  }
}

useSSERefresh(load, [
  { event: "JOB_UPDATED", filter: (data) => String(data.job_id) === jobId },
  { event: "JOB_DELETED", filter: (data) => String(data.job_id) === jobId },
  { event: "JOB_STATUS_CHANGED", filter: (data) => String(data.job_id) === jobId },
  { event: "WELL_CREATED", filter: (data) => !job.value || String(data.customer_id) === String(job.value.customer_id) },
]);

const { on } = useSSE();
on("JOB_MAGIC_LINK_CHANGED", (data) => {
  if (job.value && String(data.job_id) === String(job.value.job_id)) job.value.magic_link_token = data.token;
});

async function setStatus(status: DrillingJobStatus) {
  if (!job.value) return;
  try {
    job.value = await jobsApi.updateStatus(job.value.job_id, status);
    if (status === "SUCCESS" || status === "FAILED" || status === "CLOSED") await load();
  } catch (e) { ui.notifyError(e); }
}

async function downloadWellPdf() {
  if (!wellId.value) return;
  try {
    ui.notify("กำลังเตรียมรายงาน PDF...", "info");
    await api.download(`/wells/${wellId.value}/report.pdf`, `report-${wellId.value}.pdf`);
    ui.notify("ดาวน์โหลดรายงาน PDF สำเร็จ", "success");
  } catch (e) {
    ui.notifyError(e);
  }
}


async function regenerateMagicLink() {
  if (!job.value) return;
  try {
    const { token } = await jobsApi.generateMagicLink(job.value.job_id);
    job.value.magic_link_token = token;
    ui.notify("สร้างลิงก์ช่างใหม่แล้ว", "success");
  } catch (e) { ui.notifyError(e); }
}
</script>

<template>
  <div v-if="job" class="mx-auto" style="max-width:720px">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-2 ml-n3" @click="router.push('/jobs')">
      คิวงาน
    </v-btn>

    <!-- Main card -->
    <v-card class="pa-5 mb-4">
      <div class="d-flex justify-space-between align-start mb-2 flex-wrap ga-2">
        <div>
          <StatusChip :status="jobDisplayStatus(job)" />
          <div class="text-h6 font-display font-weight-bold mt-2">{{ job.job_title || `คิวงาน #${job.job_id}` }}</div>
        </div>
      </div>

      <div class="text-body-2 text-medium-emphasis d-flex flex-column ga-2 mt-2">
        <div class="d-flex align-center ga-2">
          <v-icon icon="mdi-map-marker-outline" size="16" />
          <span>{{ job.province ? `${job.province} · ` : "" }}{{ job.site_address || "ไม่ระบุที่ตั้ง" }}</span>
        </div>
        <div v-if="job.scheduled_date" class="d-flex align-center ga-2">
          <v-icon icon="mdi-calendar-outline" size="16" />
          <span>นัดหมาย {{ fmtDate(job.scheduled_date) }}</span>
        </div>
        <div class="d-flex align-center ga-2">
          <v-avatar v-if="job.line_picture_url" size="18">
            <v-img :src="job.line_picture_url" alt="" />
          </v-avatar>
          <v-icon v-else icon="mdi-account-outline" size="16" />
          <span>{{ job.customer_name }}</span>
          <a v-if="job.customer_phone" :href="`tel:${job.customer_phone}`" class="text-primary font-mono">
            {{ job.customer_phone }}
          </a>
        </div>
        <div v-if="job.request_id" class="d-flex align-center ga-2">
          <v-icon icon="mdi-file-document-outline" size="16" />
          <span>จากคำร้องแจ้งเจาะ #{{ job.request_id }}</span>
        </div>
        <div class="pt-1">
          <DrillerLinkChip :token="job.magic_link_token || null" path="/d/" :locked="!!wellId" @regenerate="regenerateMagicLink" />
        </div>
      </div>

      <div v-if="job.notes" class="text-caption text-medium-emphasis mt-3 pt-3" style="border-top:1px solid rgba(128,128,128,0.15)">
        <v-icon icon="mdi-note-text-outline" size="14" class="mr-1" />{{ job.notes }}
      </div>
    </v-card>

    <!-- Status Stepper -->
    <v-card class="pa-5 mb-4">
      <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold mb-3">ความคืบหน้า</div>
      <div class="d-flex align-center stepper-scroll">
        <template v-for="(s, i) in STEPS" :key="s">
          <div
            class="d-flex flex-column align-center"
            style="min-width:68px"
          >
            <v-avatar :color="i <= currentStepIndex ? JOB_STATUS[s].color || 'primary' : 'surface-variant'" size="30">
              <v-icon :icon="i < currentStepIndex ? 'mdi-check' : 'mdi-circle-medium'" color="white" size="16" />
            </v-avatar>
            <span
              class="text-caption mt-1 text-center"
              :class="i === currentStepIndex ? 'font-weight-bold' : 'text-medium-emphasis'"
            >{{ JOB_STATUS[s].label }}</span>
          </div>
          <v-divider v-if="i < STEPS.length - 1" thickness="2" class="flex-grow-1" style="margin-top:-18px" />
        </template>
      </div>

      <!-- Actions -->
      <div v-if="auth.isAdmin" class="d-flex flex-wrap ga-2 mt-4">
        <v-btn v-if="job.status === 'QUEUED'" color="deep-orange-darken-1" variant="flat" prepend-icon="mdi-play"
          @click="setStatus('DRILLING')">เริ่มเจาะ</v-btn>

        <template v-if="job.status === 'DRILLING'">
          <v-btn color="teal-darken-2" variant="flat" prepend-icon="mdi-check-circle-outline"
            @click="setStatus('SUCCESS')">เจาะสำเร็จ</v-btn>
          <v-btn color="red-darken-2" variant="flat" prepend-icon="mdi-close-circle-outline"
            @click="setStatus('FAILED')">เจาะไม่สำเร็จ</v-btn>
        </template>

        <v-btn v-if="job.status === 'SUCCESS' || job.status === 'FAILED'" variant="tonal" prepend-icon="mdi-archive"
          @click="setStatus('CLOSED')">ปิดคิว</v-btn>
      </div>
    </v-card>

    <!-- Well Log link — แสดงเฉพาะเมื่อมีข้อมูลบ่อแล้ว (บันทึกผ่าน Magic Link เท่านั้น) -->
    <v-card
      v-if="job.status === 'SUCCESS' && wellId"
      variant="tonal" color="primary"
      class="pa-5 cursor-pointer"
      @click="router.push(`/wells/${wellId}`)"
    >
      <div class="d-flex align-center justify-space-between flex-wrap ga-2">
        <span class="font-weight-bold d-flex align-center ga-2">
          <v-icon icon="mdi-layers-outline" />
          ดูประวัติบ่อบาดาล
        </span>
        <div class="d-flex align-center ga-2">
          <v-btn
            size="small"
            variant="flat"
            color="secondary"
            prepend-icon="mdi-file-pdf-box"
            @click.stop="downloadWellPdf"
          >
            ออกรายงาน PDF
          </v-btn>
          <v-icon icon="mdi-arrow-right" />
        </div>
      </div>
    </v-card>
  </div>


  <div v-else class="text-center py-10 text-medium-emphasis">
    <v-progress-circular indeterminate color="primary" class="mb-3" /><br />กำลังโหลด...
  </div>
</template>

<style scoped>
.stepper-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 4px;
}
</style>
