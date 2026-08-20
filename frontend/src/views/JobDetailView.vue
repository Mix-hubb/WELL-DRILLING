<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { jobsApi }       from "@/api/jobs";
import { wellsApi }      from "@/api/wells";
import { useUiStore }    from "@/stores/ui";
import type { DrillingJob, DrillingJobStatus } from "@/types";
import { JOB_STATUS } from "@/constants";
import StatusChip      from "@/components/StatusChip.vue";
import DrillerLinkChip from "@/components/DrillerLinkChip.vue";
import WellLogFormDialog from "@/components/forms/WellLogFormDialog.vue";

const route  = useRoute();
const router = useRouter();
const ui     = useUiStore();

const job          = ref<DrillingJob | null>(null);
const wellId       = ref<number | null>(null);
const showWellForm = ref(false);

const STEPS: DrillingJobStatus[] = ["QUEUED", "DRILLING", "SUCCESS", "FAILED", "CLOSED"];
const currentStepIndex = computed(() => (job.value ? STEPS.indexOf(job.value.status as DrillingJobStatus) : 0));

async function load() {
  try {
    job.value = await jobsApi.getOne(route.params.id as string);
    wellId.value = job.value?.well_id ?? null;
  } catch (e) {
    ui.notifyError(e);
  }
}

onMounted(load);

async function setStatus(status: DrillingJobStatus) {
  if (!job.value) return;
  try {
    job.value = await jobsApi.updateStatus(job.value.job_id, status);
    if (status === "SUCCESS" || status === "FAILED" || status === "CLOSED") await load();
  } catch (e) { ui.notifyError(e); }
}

async function createWellLog(form: any) {
  if (!job.value) return;
  try {
    const well = await wellsApi.create({ customer_id: job.value.customer_id, ...form });
    showWellForm.value = false;
    ui.notify("บันทึกข้อมูลบ่อบาดาลแล้ว ประกัน 2 ปีเริ่มนับจากวันเจาะเสร็จ", "success");
    router.push(`/wells/${well.well_id}`);
  } catch (e) { ui.notifyError(e); }
}

async function regenerateMagicLink() {
  if (!job.value) return;
  try {
    const { token } = await jobsApi.generateMagicLink(job.value.job_id);
    job.value.magic_link_token = token;
    ui.notify("สร้างลิงก์ช่างใหม่แล้ว", "success");
  } catch (e) { ui.notifyError(e); }
}

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}
</script>

<template>
  <div v-if="job" style="max-width:720px">
    <v-btn variant="text" prepend-icon="mdi-arrow-left" class="mb-2 ml-n3" @click="router.push('/jobs')">
      คิวงาน
    </v-btn>

    <!-- Main card -->
    <v-card class="pa-5 mb-4">
      <div class="d-flex justify-space-between align-start mb-2 flex-wrap ga-2">
        <div>
          <StatusChip :status="job.status" />
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
          <v-icon icon="mdi-account-outline" size="16" />
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
          <DrillerLinkChip :token="job.magic_link_token || null" path="/d/" @regenerate="regenerateMagicLink" />
        </div>
      </div>

      <div v-if="job.notes" class="text-caption text-medium-emphasis mt-3 pt-3" style="border-top:1px solid rgba(128,128,128,0.15)">
        <v-icon icon="mdi-note-text-outline" size="14" class="mr-1" />{{ job.notes }}
      </div>
    </v-card>

    <!-- Status Stepper -->
    <v-card class="pa-5 mb-4">
      <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold mb-3">ความคืบหน้า</div>
      <div class="d-flex align-center">
        <template v-for="(s, i) in STEPS" :key="s">
          <div
            class="d-flex flex-column align-center"
            style="min-width:70px"
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
      <div class="d-flex flex-wrap ga-2 mt-4">
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

    <!-- Well Log link -->
    <v-card
      v-if="job.status === 'SUCCESS'"
      variant="tonal" color="primary"
      class="pa-5 cursor-pointer"
      @click="wellId ? router.push(`/wells/${wellId}`) : (showWellForm = true)"
    >
      <div class="d-flex align-center justify-space-between">
        <span class="font-weight-bold d-flex align-center ga-2">
          <v-icon icon="mdi-layers-outline" />
          {{ wellId ? "ดูประวัติบ่อบาดาล" : "+ บันทึกประวัติบ่อบาดาล (เริ่มประกัน 2 ปี)" }}
        </span>
        <v-icon icon="mdi-arrow-right" />
      </div>
    </v-card>

    <WellLogFormDialog v-model="showWellForm" @submit="createWellLog" />
  </div>

  <div v-else class="text-center py-10 text-medium-emphasis">
    <v-progress-circular indeterminate color="primary" class="mb-3" /><br />กำลังโหลด...
  </div>
</template>
