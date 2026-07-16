<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { jobsApi }       from "@/api/jobs";
import { useWellsStore } from "@/stores/wells";
import { useUiStore }    from "@/stores/ui";
import type { DrillingJob, JobStatus } from "@/types";
import { STATUS } from "@/constants";
import StatusChip      from "@/components/StatusChip.vue";
import WarrantyBadge   from "@/components/WarrantyBadge.vue";
import WellLogFormDialog from "@/components/forms/WellLogFormDialog.vue";

const route      = useRoute();
const router     = useRouter();
const wellsStore = useWellsStore();
const ui         = useUiStore();

const job         = ref<DrillingJob | null>(null);
const wellId      = ref<number | null>(null);
const showWellForm = ref(false);

const STEPS: JobStatus[] = ["PENDING", "DRILLING", "COMPLETED"];
const currentStepIndex = computed(() => (job.value ? STEPS.indexOf(job.value.status as JobStatus) : 0));

async function load() {
  try {
    job.value = await jobsApi.getOne(route.params.id as string);
    wellId.value = job.value?.well_id ?? null;
  } catch (e) {
    ui.notifyError(e);
  }
}

onMounted(load);

async function setStatus(status: JobStatus) {
  if (!job.value) return;
  try {
    job.value = await jobsApi.updateStatus(job.value.job_id, status);
    if (status === "COMPLETED") await load(); // reload to get well_id if exists
  } catch (e) { ui.notifyError(e); }
}

async function createWellLog(form: any) {
  if (!job.value) return;
  try {
    const well = await wellsStore.create({ job_id: job.value.job_id, ...form });
    showWellForm.value = false;
    ui.notify("บันทึกข้อมูลบ่อบาดาลแล้ว ประกัน 2 ปีเริ่มนับจากวันนี้", "success");
    router.push(`/wells/${well.well_id}`);
  } catch (e) { ui.notifyError(e); }
}

function copyCoords() {
  if (!job.value?.latitude) return;
  navigator.clipboard.writeText(`${job.value.latitude}, ${job.value.longitude}`);
  ui.notify("คัดลอกพิกัดแล้ว", "success");
}

const mapsUrl = computed(() =>
  job.value?.latitude ? `https://www.google.com/maps?q=${job.value.latitude},${job.value.longitude}` : "#"
);

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function alertTier(w: DrillingJob): "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" {
  if (!w.warranty_expire_date) return "EXPIRED";
  const days = Math.ceil((new Date(w.warranty_expire_date).getTime() - Date.now()) / 86400000);
  if (days < 0)   return "EXPIRED";
  if (days <= 30) return "EXPIRING_SOON";
  return "ACTIVE";
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
          <div class="text-h6 font-display font-weight-bold mt-2">{{ job.job_title }}</div>
          <div class="font-mono text-caption text-medium-emphasis">{{ job.job_reference }}</div>
        </div>
        <WarrantyBadge
          v-if="job.warranty_expire_date"
          :alert-tier="alertTier(job)"
          :remaining-days="Math.ceil((new Date(job.warranty_expire_date!).getTime() - Date.now()) / 86400000)"
          :expiry-date="job.warranty_expire_date!"
        />
      </div>

      <!-- Priority -->
      <v-chip
        v-if="job.priority !== 'NORMAL'"
        :color="job.priority === 'URGENT' ? 'error' : 'warning'"
        size="x-small" variant="tonal" class="mb-3"
      >{{ job.priority === "URGENT" ? "🔴 เร่งด่วน" : "🟡 สำคัญ" }}</v-chip>

      <div class="text-body-2 text-medium-emphasis d-flex flex-column ga-2 mt-2">
        <div class="d-flex align-center ga-2">
          <v-icon icon="mdi-map-marker-outline" size="16" />
          <span>{{ job.province ? `${job.province} · ` : "" }}{{ job.site_address }}</span>
        </div>
        <div v-if="job.latitude" class="d-flex align-center ga-2 font-mono text-caption">
          <span>{{ job.latitude }}, {{ job.longitude }}</span>
          <v-btn icon="mdi-content-copy" size="x-small" variant="text" @click="copyCoords" />
          <a :href="mapsUrl" target="_blank" class="text-primary" style="text-decoration:none">
            <v-btn icon="mdi-map-search-outline" size="x-small" variant="text" />
          </a>
        </div>
        <div class="d-flex align-center ga-2">
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
        <div v-if="job.requested_depth_m" class="d-flex align-center ga-2">
          <v-icon icon="mdi-ruler" size="16" />
          <span>ความลึกที่ขอ {{ job.requested_depth_m }} ม.</span>
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
            class="d-flex flex-column align-center cursor-pointer"
            style="min-width:80px"
            @click="setStatus(s)"
          >
            <v-avatar :color="i <= currentStepIndex ? STATUS[s as keyof typeof STATUS]?.color || 'primary' : 'surface-variant'" size="34">
              <v-icon :icon="i < currentStepIndex ? 'mdi-check' : 'mdi-circle-medium'" color="white" />
            </v-avatar>
            <span
              class="text-caption mt-1 text-center"
              :class="i === currentStepIndex ? 'font-weight-bold' : 'text-medium-emphasis'"
            >{{ STATUS[s as keyof typeof STATUS]?.label || s }}</span>
          </div>
          <v-divider v-if="i < STEPS.length - 1" thickness="2" class="flex-grow-1" style="margin-top:-20px" />
        </template>
      </div>
    </v-card>

    <!-- Well Log link -->
    <v-card
      v-if="job.status === 'COMPLETED'"
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
