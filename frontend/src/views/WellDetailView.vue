<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useWellsStore } from "@/stores/wells";
import { useUiStore } from "@/stores/ui";
import { api } from "@/api/client";
import { PIPE_MATERIAL, PIPE_TYPE, PUMP_TYPE, LITHOLOGY_TYPE, PROTECTION_TYPE } from "@/constants";
import StrataColumn from "@/components/StrataColumn.vue";
import SectionHeader from "@/components/SectionHeader.vue";
import WarrantyBadge from "@/components/WarrantyBadge.vue";
import StrataFormDialog from "@/components/forms/StrataFormDialog.vue";
import PipeFormDialog from "@/components/forms/PipeFormDialog.vue";
import PumpFormDialog from "@/components/forms/PumpFormDialog.vue";
import ControlBoxFormDialog from "@/components/forms/ControlBoxFormDialog.vue";

const route  = useRoute();
const router = useRouter();
const store  = useWellsStore();
const ui     = useUiStore();

/* ---- dialogs ---- */
const showStrata    = ref(false);
const showPipe      = ref(false);
const showPump      = ref(false);
const showCtrl      = ref(false);

const wellId = () => Number(route.params.id);

onMounted(async () => {
  try {
    await store.fetchOne(String(route.params.id));
  } catch (e) { ui.notifyError(e); }
});

async function addStrata(form: any) {
  try { await store.addStrata(wellId(), form); showStrata.value = false; ui.notify("เพิ่มชั้นดิน/หินแล้ว", "success"); }
  catch (e) { ui.notifyError(e); }
}
async function addPipe(form: any) {
  try { await store.addPipe(wellId(), form); showPipe.value = false; ui.notify("เพิ่มท่อแล้ว", "success"); }
  catch (e) { ui.notifyError(e); }
}
async function addPump(form: any) {
  try { await store.addPump(wellId(), form); showPump.value = false; ui.notify("เพิ่มปั๊มแล้ว", "success"); }
  catch (e) { ui.notifyError(e); }
}
async function addControlBox(form: any) {
  try { await store.addControlBox(wellId(), form); showCtrl.value = false; ui.notify("เพิ่มตู้คอนโทรลแล้ว", "success"); }
  catch (e) { ui.notifyError(e); }
}
async function removeStrata(id: number) { try { await store.removeStrata(wellId(), id); } catch (e) { ui.notifyError(e); } }
async function removePipe(id: number)   { try { await store.removePipe(wellId(), id); } catch (e) { ui.notifyError(e); } }
async function removePump(id: number)   { try { await store.removePump(wellId(), id); } catch (e) { ui.notifyError(e); } }
async function removeControlBox(id: number) { try { await store.removeControlBox(wellId(), id); } catch (e) { ui.notifyError(e); } }

function downloadReport() { api.download(`/wells/${wellId()}/report.pdf`, `report-${wellId()}.pdf`).catch(e => ui.notifyError(e)); }

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function alertTier(w: any): "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" {
  const days = Number(w.days_left);
  if (w.warranty_status !== "ACTIVE") return "EXPIRED";
  if (days <= 30) return "EXPIRING_SOON";
  return "ACTIVE";
}
</script>

<template>
  <div v-if="store.current" style="max-width:900px">
    <!-- Back + Actions -->
    <div class="d-flex align-center justify-space-between mb-3">
      <v-btn variant="text" prepend-icon="mdi-arrow-left" class="ml-n3" @click="router.push('/wells')">
        บ่อบาดาล
      </v-btn>
      <v-btn color="secondary" variant="tonal" prepend-icon="mdi-file-pdf-box" @click="downloadReport">
        ออกรายงาน PDF
      </v-btn>
    </div>

    <!-- Well Summary Card -->
    <v-card class="pa-5 mb-4">
      <div class="d-flex align-start justify-space-between flex-wrap ga-2 mb-3">
        <div>
          <div class="text-h6 font-display font-weight-bold">{{ store.current.well_name || `บ่อบาดาล #${store.current.well_id}` }}</div>
          <div class="text-caption text-medium-emphasis mt-1 d-flex align-center ga-1">
            <v-avatar v-if="store.current.line_picture_url" size="20">
              <v-img :src="store.current.line_picture_url" alt="" />
            </v-avatar>
            <v-icon v-else icon="mdi-account-outline" size="14" />
            {{ store.current.customer_name || `ลูกค้า #${store.current.customer_id}` }}
          </div>
          <div v-if="store.current.address" class="text-caption text-medium-emphasis mt-1">
            <v-icon icon="mdi-map-marker-outline" size="14" />
            {{ store.current.address }}
          </div>
        </div>
        <WarrantyBadge
          v-if="store.current.warranty_expire_date && store.current.warranty_status"
          :alert-tier="alertTier(store.current)"
          :remaining-days="Number(store.current.days_left ?? 0)"
          :expiry-date="store.current.warranty_expire_date"
        />
      </div>

      <v-row dense>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">ความลึกรวม</div>
          <div class="font-mono font-weight-bold">{{ store.current.total_depth_m }} ม.</div>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">ปริมาณน้ำ</div>
          <div class="font-mono font-weight-bold">{{ store.current.water_quantity_m3hr }} ม³/ชม.</div>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">ระดับน้ำนิ่ง</div>
          <div class="font-mono font-weight-bold">{{ store.current.static_water_level_m }} ม.</div>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">ระดับน้ำลด</div>
          <div class="font-mono font-weight-bold">{{ store.current.pumping_water_level_m }} ม.</div>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">วันเสร็จ</div>
          <div class="font-mono font-weight-bold">{{ fmtDate(store.current.completion_date ?? '') }}</div>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">หมดประกัน</div>
          <div class="font-mono font-weight-bold">{{ fmtDate(store.current.warranty_expire_date ?? '') }}</div>
        </v-col>
      </v-row>

      <div v-if="store.current.result" class="text-caption text-medium-emphasis mt-3">
        <v-icon icon="mdi-information-outline" size="14" class="mr-1" />
        ผลการเจาะ: {{ store.current.result === "SUCCESS" ? "สำเร็จ" : "ไม่สำเร็จ" }}
        <template v-if="store.current.failure_reason"> — {{ store.current.failure_reason }}</template>
      </div>

      <div v-if="store.current.notes" class="text-caption text-medium-emphasis mt-3 pt-3" style="border-top:1px solid rgba(128,128,128,0.15)">
        <v-icon icon="mdi-note-text-outline" size="14" class="mr-1" />{{ store.current.notes }}
      </div>
    </v-card>

    <!-- ===== Strata Visualizer ===== -->
    <SectionHeader title="ชั้นดิน / ชั้นหิน" icon="mdi-layers-outline" @add="showStrata = true" />
    <v-card class="pa-4 mb-4">
      <StrataColumn
        v-if="store.current.strata.length"
        :strata="(store.current.strata as any[])"
        :total-depth="Number(store.current.total_depth_m) || 0"
        :pipes="(store.current.pipes as any[])"
      />
      <div v-else class="text-center py-6 text-medium-emphasis">ยังไม่มีข้อมูลชั้นดิน/หิน</div>

      <!-- Strata table -->
      <div v-if="store.current.strata.length" class="mt-4">
        <div
          v-for="s in store.current.strata" :key="s.strata_id"
          class="d-flex justify-space-between align-center text-caption py-1"
          style="border-bottom:1px solid rgba(0,0,0,0.06)"
        >
          <span class="font-mono text-medium-emphasis" style="min-width:90px">{{ s.depth_from_m }}–{{ s.depth_to_m }} ม.</span>
          <span class="flex-grow-1 px-2">
            {{ s.lithology_type ? (LITHOLOGY_TYPE[s.lithology_type as keyof typeof LITHOLOGY_TYPE] || s.lithology_name || "-") : (s.lithology_name || "-") }}
          </span>
          <span v-if="s.water_bearing" class="text-primary mr-2">💧</span>
          <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" @click="removeStrata(s.strata_id)" />
        </div>
      </div>
    </v-card>

    <!-- ===== Pipes ===== -->
    <SectionHeader title="โปรแกรมท่อบ่อ" icon="mdi-pipe" @add="showPipe = true" />
    <v-card class="pa-4 mb-4">
      <div v-if="!store.current.pipes.length" class="text-center py-6 text-medium-emphasis">ยังไม่มีข้อมูลท่อ</div>
      <div
        v-for="p in store.current.pipes" :key="p.pipe_id"
        class="d-flex justify-space-between align-center text-body-2 py-2 flex-wrap ga-1"
        style="border-bottom:1px solid rgba(0,0,0,0.06)"
      >
        <div style="min-width:0;word-break:break-word">
          <span class="font-mono text-caption text-medium-emphasis">{{ p.depth_from_m }}–{{ p.depth_to_m }} ม.</span>
          {{ " " }}{{ PIPE_MATERIAL[p.material as keyof typeof PIPE_MATERIAL] || "-" }}
          <span class="text-medium-emphasis">· {{ PIPE_TYPE[p.pipe_type as keyof typeof PIPE_TYPE] || "-" }} · {{ p.size_mm }} มม. × {{ p.quantity }} ชิ้น</span>
        </div>
        <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" @click="removePipe(p.pipe_id)" />
      </div>
    </v-card>

    <!-- ===== Pumps ===== -->
    <SectionHeader title="ปั๊มน้ำบาดาล" icon="mdi-water-pump" @add="showPump = true" />
    <v-card class="pa-4 mb-4">
      <div v-if="!store.current.pumps.length" class="text-center py-6 text-medium-emphasis">ยังไม่มีข้อมูลปั๊ม</div>
      <div
        v-for="p in store.current.pumps" :key="p.pump_id"
        class="d-flex justify-space-between align-center text-body-2 py-2 flex-wrap ga-1"
        style="border-bottom:1px solid rgba(0,0,0,0.06)"
      >
        <div style="min-width:0;word-break:break-word">
          <div>{{ PUMP_TYPE[p.pump_type as keyof typeof PUMP_TYPE] || "-" }} · {{ p.brand }} {{ p.pump_model || "" }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ p.horsepower }} HP · {{ p.impeller_stages }} ใบพัด · หย่อนที่ {{ p.installation_depth_m }} ม.
            <template v-if="p.voltage"> · {{ p.voltage }} V</template>
            <template v-if="p.phase"> · {{ p.phase }} เฟส</template>
            <template v-if="p.rated_flow_m3hr"> · ไหล {{ p.rated_flow_m3hr }} ม³/ชม.</template>
            <template v-if="p.rated_head_m"> · เฮด {{ p.rated_head_m }} ม.</template>
            <template v-if="p.installed_date"> · ติดตั้ง {{ fmtDate(p.installed_date) }}</template>
          </div>
        </div>
        <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" @click="removePump(p.pump_id)" />
      </div>
    </v-card>

    <!-- ===== Control Boxes ===== -->
    <SectionHeader title="ตู้คอนโทรล" icon="mdi-electronics-outline" @add="showCtrl = true" />
    <v-card class="pa-4 mb-6">
      <div v-if="!store.current.control_boxes.length" class="text-center py-6 text-medium-emphasis">ยังไม่มีข้อมูลตู้คอนโทรล</div>
      <div
        v-for="c in store.current.control_boxes" :key="c.control_box_id"
        class="d-flex justify-space-between align-center text-body-2 py-2 flex-wrap ga-1"
        style="border-bottom:1px solid rgba(0,0,0,0.06)"
      >
        <div style="min-width:0;word-break:break-word">
          <div>{{ c.brand }} {{ c.model }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ c.capacity || "-" }}
            <template v-if="c.voltage"> · {{ c.voltage }} V</template>
            <template v-if="c.protection_type"> · ป้องกัน: {{ PROTECTION_TYPE[c.protection_type as keyof typeof PROTECTION_TYPE] || c.protection_type }}</template>
            <template v-if="c.features"> · {{ c.features }}</template>
            <template v-if="c.installed_date"> · ติดตั้ง {{ fmtDate(c.installed_date) }}</template>
          </div>
        </div>
        <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" @click="removeControlBox(c.control_box_id)" />
      </div>
    </v-card>

    <!-- Dialogs -->
    <StrataFormDialog v-model="showStrata" @submit="addStrata" />
    <PipeFormDialog   v-model="showPipe"   @submit="addPipe"   />
    <PumpFormDialog   v-model="showPump"   @submit="addPump"   />
    <ControlBoxFormDialog v-model="showCtrl" @submit="addControlBox" />
  </div>

  <div v-else class="text-center py-10 text-medium-emphasis">
    <v-progress-circular indeterminate color="primary" class="mb-3" /><br />กำลังโหลด...
  </div>
</template>
