<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { statsApi } from "@/api/stats";
import { useUiStore } from "@/stores/ui";
import { useSSE } from "@/composables/useSSE";
import type { StatsOverview } from "@/types";
import { JOB_STATUS_HEX } from "@/constants";
import StatCard   from "@/components/StatCard.vue";
import DonutChart from "@/components/DonutChart.vue";
import StatusChip from "@/components/StatusChip.vue";

const ui     = useUiStore();
const router = useRouter();
const stats  = ref<StatsOverview | null>(null);
const loading = ref(true);
const { connect, on } = useSSE();

async function refreshStats() {
  try {
    stats.value = await statsApi.overview();
  } catch (e) {
    ui.notifyError(e);
  }
}

onMounted(async () => {
  await refreshStats();
  loading.value = false;

  connect();
  on("JOB_CREATED", refreshStats);
  on("JOB_STATUS_CHANGED", refreshStats);
  on("DRILLING_REQUEST_CHANGED", refreshStats);
  on("REPAIR_REQUEST_CHANGED", refreshStats);
});

const statusSegments = computed(() => {
  if (!stats.value) return [];
  return [
    { label: "รอเจาะ",       value: stats.value.jobs.queued,   color: JOB_STATUS_HEX.QUEUED   },
    { label: "กำลังเจาะ",    value: stats.value.jobs.drilling, color: JOB_STATUS_HEX.DRILLING  },
    { label: "เจาะสำเร็จ",   value: stats.value.jobs.success,  color: JOB_STATUS_HEX.SUCCESS   },
    { label: "เจาะไม่สำเร็จ", value: stats.value.jobs.failed,   color: JOB_STATUS_HEX.FAILED    },
  ];
});

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("th-TH", { month: "short", day: "numeric" });
}

const todayLabel = new Date().toLocaleDateString("th-TH", {
  weekday: "long", year: "numeric", month: "long", day: "numeric",
});
</script>

<template>
  <div>
    <div v-if="loading" class="text-center py-10 text-medium-emphasis">
      <v-progress-circular indeterminate color="primary" class="mb-3" /><br />กำลังโหลด...
    </div>

    <template v-else-if="stats">
      <!-- ===== Hero header ===== -->
      <div class="d-flex align-center justify-space-between mb-4 px-1 fade-up">
        <div>
          <div class="text-h5 font-display font-weight-bold">
            ภาพรวมงาน <span class="gradient-text">วันนี้</span>
          </div>
          <div class="text-caption text-medium-emphasis">{{ todayLabel }}</div>
        </div>
        <v-btn color="primary" variant="tonal" to="/drilling-requests" prepend-icon="mdi-plus">
          เพิ่มงานใหม่
        </v-btn>
      </div>

      <!-- ===== Row 1: KPI Cards ===== -->
      <v-row class="fade-up" style="animation-delay: 0.05s">
        <v-col cols="6" md="3">
          <StatCard label="คิวงานทั้งหมด" :value="String(stats.jobs.total)"
            icon="mdi-hammer-wrench" color="primary" />
        </v-col>
        <v-col cols="6" md="3">
          <StatCard label="บ่อที่เจาะสำเร็จ" :value="String(stats.wells.count)"
            icon="mdi-layers-outline" color="success" />
        </v-col>
        <v-col cols="6" md="3">
          <StatCard label="ความลึกเฉลี่ย" :value="`${stats.wells.avgDepth.toFixed(1)} ม.`"
            icon="mdi-ruler" color="secondary" :sub="`ลึกสุด ${stats.wells.maxDepth} ม.`" />
        </v-col>
        <v-col cols="6" md="3">
          <StatCard label="คำร้องใหม่ (เจาะ+ซ่อม)" :value="String(stats.requests.new + stats.repairs.new)"
            icon="mdi-file-document-alert-outline" color="warning"
            :sub="`ประกันใกล้หมด ${stats.warranty.expiringSoon} บ่อ`" />
        </v-col>
      </v-row>

      <!-- ===== Row 2: Warranty Banner (ถ้ามีใกล้หมด) ===== -->
      <v-alert
        v-if="stats.warranty.expiringSoon > 0"
        type="warning"
        variant="tonal"
        class="mt-4"
        icon="mdi-shield-alert-outline"
        :text="`มีบ่อที่ประกันใกล้หมด ${stats.warranty.expiringSoon} บ่อ (ภายใน 30 วัน)`"
        closable
      >
        <template #append>
          <v-btn size="small" variant="text" to="/wells" append-icon="mdi-arrow-right">
            ดูทั้งหมด
          </v-btn>
        </template>
      </v-alert>

      <!-- ===== Row 3: Charts ===== -->
      <v-row class="mt-2 fade-up" style="animation-delay: 0.15s">
        <v-col cols="12" md="5">
          <v-card class="pa-4 h-100">
            <div class="d-flex align-center ga-2 mb-3">
              <div class="section-head-icon"><v-icon icon="mdi-chart-donut" size="18" /></div>
              <div class="text-subtitle-1 font-display font-weight-bold">สัดส่วนสถานะคิวงาน</div>
            </div>
            <DonutChart :segments="statusSegments" />
          </v-card>
        </v-col>
        <v-col cols="12" md="7">
          <v-card class="pa-4 h-100">
            <div class="d-flex align-center ga-2 mb-3">
              <div class="section-head-icon"><v-icon icon="mdi-alert-decagram-outline" size="18" /></div>
              <div class="text-subtitle-1 font-display font-weight-bold">งานที่ต้องติดตาม</div>
            </div>
            <div class="d-flex flex-column ga-2">
              <div class="track-item">
                <span class="text-body-2">📋 คำร้องแจ้งเจาะใหม่ / รอใบราคา</span>
                <span class="font-mono font-weight-bold text-primary">{{ stats.requests.new + stats.requests.quoted }}</span>
              </div>
              <div class="track-item">
                <span class="text-body-2">🔧 แจ้งซ่อมใหม่ / กำลังซ่อม</span>
                <span class="font-mono font-weight-bold text-success">{{ stats.repairs.new + stats.repairs.inProgress }}</span>
              </div>
              <div class="track-item">
                <span class="text-body-2">⛔ คิวเจาะไม่สำเร็จ</span>
                <span class="font-mono font-weight-bold text-warning">{{ stats.jobs.failed }}</span>
              </div>
              <div class="track-item">
                <span class="text-body-2">❌ ประกันหมดแล้ว</span>
                <span class="font-mono font-weight-bold text-error">{{ stats.warranty.expired }}</span>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- ===== Row 4: Warranty Summary + Recent Jobs ===== -->
      <v-row class="mt-2 fade-up" style="animation-delay: 0.25s">
        <!-- Warranty mini -->
        <v-col cols="12" md="4">
          <v-card class="pa-4 h-100">
            <div class="d-flex justify-space-between align-center mb-3">
              <div class="d-flex align-center ga-2">
                <div class="section-head-icon"><v-icon icon="mdi-shield-check-outline" size="18" /></div>
                <div class="text-subtitle-1 font-display font-weight-bold">สรุปประกัน 2 ปี</div>
              </div>
              <v-btn size="small" variant="text" to="/wells" append-icon="mdi-arrow-right">ดูทั้งหมด</v-btn>
            </div>
            <div class="d-flex flex-column ga-2">
              <div class="track-item">
                <span class="text-caption">✅ ในประกัน</span>
                <span class="font-mono font-weight-bold text-success">{{ stats.warranty.active }}</span>
              </div>
              <div class="track-item">
                <span class="text-caption">⚠️ ใกล้หมด</span>
                <span class="font-mono font-weight-bold text-warning">{{ stats.warranty.expiringSoon }}</span>
              </div>
              <div class="track-item">
                <span class="text-caption">❌ หมดแล้ว</span>
                <span class="font-mono font-weight-bold text-error">{{ stats.warranty.expired }}</span>
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Recent jobs -->
        <v-col cols="12" md="8">
          <v-card class="pa-4 h-100">
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="d-flex align-center ga-2">
                <div class="section-head-icon"><v-icon icon="mdi-hammer-wrench" size="18" /></div>
                <div class="text-subtitle-1 font-display font-weight-bold">คิวงานล่าสุด</div>
              </div>
              <v-btn size="small" variant="text" append-icon="mdi-arrow-right" to="/jobs">ดูทั้งหมด</v-btn>
            </div>
            <v-list density="compact">
              <v-list-item
                v-for="j in stats.recentJobs" :key="j.job_id"
                :title="j.job_title || `คิวงาน #${j.job_id}`"
                :subtitle="`${j.customer_name} · ${fmtDate(j.scheduled_date || '')}`"
                @click="router.push(`/jobs/${j.job_id}`)"
                class="px-0 cursor-pointer"
              >
                <template #append><StatusChip :status="j.status" /></template>
              </v-list-item>
              <div v-if="!stats.recentJobs.length" class="text-caption text-medium-emphasis">ยังไม่มีคิวงาน</div>
            </v-list>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </div>
</template>
