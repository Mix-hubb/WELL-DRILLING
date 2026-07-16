<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { statsApi } from "@/api/stats";
import { warrantyApi, type WarrantySummary } from "@/api/warranty";
import { useUiStore } from "@/stores/ui";
import type { StatsOverview } from "@/types";
import { STATUS_HEX, STRATA } from "@/constants";
import StatCard   from "@/components/StatCard.vue";
import DonutChart from "@/components/DonutChart.vue";
import BarChart   from "@/components/BarChart.vue";
import StatusChip from "@/components/StatusChip.vue";

const ui     = useUiStore();
const router = useRouter();
const stats   = ref<StatsOverview | null>(null);
const warranty = ref<WarrantySummary>({ total: 0, active: 0, expiringSoon: 0, expired: 0 });
const loading = ref(true);

onMounted(async () => {
  try {
    const [s, w] = await Promise.all([
      statsApi.overview(),
      warrantyApi.summary(),
    ]);
    stats.value   = s;
    warranty.value = w;
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
});

const statusSegments = computed(() => {
  if (!stats.value) return [];
  return [
    { label: "รอดำเนินการ", value: stats.value.jobs.pending,   color: STATUS_HEX.PENDING   },
    { label: "กำลังเจาะ",   value: stats.value.jobs.drilling,  color: STATUS_HEX.DRILLING  },
    { label: "เจาะสำเร็จ",  value: stats.value.jobs.completed, color: STATUS_HEX.COMPLETED },
  ];
});

const strataBars = computed(() => {
  if (!stats.value) return [];
  return stats.value.strataBreakdown.map((s: any) => ({
    label: s.strata_label || s.strata_type,
    value: Math.round(s.total_meters),
    color: s.color_hex || "#A0856C",
  }));
});

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("th-TH", { month: "short", day: "numeric" });
}
</script>

<template>
  <div>
    <div v-if="loading" class="text-center py-10 text-medium-emphasis">
      <v-progress-circular indeterminate color="primary" class="mb-3" /><br />กำลังโหลด...
    </div>

    <template v-else-if="stats">
      <!-- ===== Row 1: KPI Cards ===== -->
      <v-row>
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
          <StatCard label="ประกันใกล้หมด" :value="String(warranty.expiringSoon)"
            icon="mdi-shield-alert-outline" color="warning"
            :sub="`หมดแล้ว ${warranty.expired} บ่อ`" />
        </v-col>
      </v-row>

      <!-- ===== Row 2: Warranty Banner (ถ้ามีใกล้หมด) ===== -->
      <v-alert
        v-if="warranty.expiringSoon > 0"
        type="warning"
        variant="tonal"
        class="mt-4"
        icon="mdi-shield-alert-outline"
        :text="`มีบ่อที่ประกันใกล้หมด ${warranty.expiringSoon} บ่อ (ภายใน 30 วัน)`"
        closable
      >
        <template #append>
          <v-btn size="small" variant="text" to="/warranty" append-icon="mdi-arrow-right">
            ดูทั้งหมด
          </v-btn>
        </template>
      </v-alert>

      <!-- ===== Row 3: Charts ===== -->
      <v-row class="mt-2">
        <v-col cols="12" md="5">
          <v-card class="pa-4 h-100">
            <div class="text-subtitle-1 font-display font-weight-bold mb-3">สัดส่วนสถานะคิวงาน</div>
            <DonutChart :segments="statusSegments" />
          </v-card>
        </v-col>
        <v-col cols="12" md="7">
          <v-card class="pa-4 h-100">
            <div class="text-subtitle-1 font-display font-weight-bold mb-3">ความลึกชั้นดิน/หินสะสม (ม.)</div>
            <BarChart :bars="strataBars" unit=" ม." />
            <div v-if="!strataBars.length" class="text-caption text-medium-emphasis">ยังไม่มีข้อมูลชั้นดิน/หิน</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- ===== Row 4: Warranty Summary + Recent Jobs ===== -->
      <v-row class="mt-2">
        <!-- Warranty mini -->
        <v-col cols="12" md="4">
          <v-card class="pa-4 h-100">
            <div class="d-flex justify-space-between align-center mb-3">
              <div class="text-subtitle-1 font-display font-weight-bold">สรุปประกัน 2 ปี</div>
              <v-btn size="small" variant="text" to="/warranty" append-icon="mdi-arrow-right">ดูทั้งหมด</v-btn>
            </div>
            <div class="d-flex flex-column ga-2">
              <div class="d-flex justify-space-between align-center pa-2 rounded-lg" style="background:rgba(78,122,82,0.1)">
                <span class="text-caption">✅ ในประกัน</span>
                <span class="font-mono font-weight-bold text-success">{{ warranty.active }}</span>
              </div>
              <div class="d-flex justify-space-between align-center pa-2 rounded-lg" style="background:rgba(138,106,42,0.1)">
                <span class="text-caption">⚠️ ใกล้หมด</span>
                <span class="font-mono font-weight-bold text-warning">{{ warranty.expiringSoon }}</span>
              </div>
              <div class="d-flex justify-space-between align-center pa-2 rounded-lg" style="background:rgba(122,58,42,0.1)">
                <span class="text-caption">❌ หมดแล้ว</span>
                <span class="font-mono font-weight-bold text-error">{{ warranty.expired }}</span>
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- Recent jobs -->
        <v-col cols="12" md="8">
          <v-card class="pa-4 h-100">
            <div class="d-flex align-center justify-space-between mb-3">
              <div class="text-subtitle-1 font-display font-weight-bold">คิวงานล่าสุด</div>
              <v-btn size="small" variant="text" append-icon="mdi-arrow-right" to="/jobs">ดูทั้งหมด</v-btn>
            </div>
            <v-list density="compact">
              <v-list-item
                v-for="j in stats.recentJobs" :key="j.job_id"
                :title="j.job_title"
                :subtitle="`${j.customer_name} · ${fmtDate(j.scheduled_date)}`"
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
