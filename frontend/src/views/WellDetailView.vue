<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useWellsStore } from "@/stores/wells";
import { useUiStore } from "@/stores/ui";
import { wellsApi } from "@/api/wells";
import { api } from "@/api/client";
import { maintenanceApi, type MaintenanceLog, type MaintenanceEventType } from "@/api/maintenance";
import { PIPE_TYPE, PIPE_SIZE, THICKNESS, PUMP_TYPE } from "@/constants";
import StrataColumn from "@/components/StrataColumn.vue";
import SectionHeader from "@/components/SectionHeader.vue";
import WarrantyBadge from "@/components/WarrantyBadge.vue";
import MaintenanceTimeline from "@/components/MaintenanceTimeline.vue";
import StrataFormDialog from "@/components/forms/StrataFormDialog.vue";
import PipeFormDialog from "@/components/forms/PipeFormDialog.vue";
import PumpFormDialog from "@/components/forms/PumpFormDialog.vue";

const route  = useRoute();
const router = useRouter();
const store  = useWellsStore();
const ui     = useUiStore();

/* ---- dialogs ---- */
const showStrata = ref(false);
const showPipe   = ref(false);
const showPump   = ref(false);
const showMaint  = ref(false);

/* ---- maintenance ---- */
const maintenance  = ref<MaintenanceLog[]>([]);
const eventTypes   = ref<MaintenanceEventType[]>([]);
const maintLoading = ref(false);
const maintForm    = ref({
  event_type_id: null as number | null,
  event_date: new Date().toISOString().slice(0, 10),
  description: "",
  performed_by: "",
  next_service_date: "",
  is_warranty_claim: false,
});

const wellId = () => Number(route.params.id);

onMounted(async () => {
  try {
    await store.fetchOne(String(route.params.id));
    await loadMaintenance();
    const et = await maintenanceApi.listEventTypes();
    eventTypes.value = et;
  } catch (e) { ui.notifyError(e); }
});

async function loadMaintenance() {
  maintLoading.value = true;
  try {
    maintenance.value = await maintenanceApi.listByWell(wellId());
  } finally {
    maintLoading.value = false;
  }
}

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
async function removeStrata(id: number) { try { await store.removeStrata(wellId(), id); } catch (e) { ui.notifyError(e); } }
async function removePipe(id: number)   { try { await store.removePipe(wellId(), id); } catch (e) { ui.notifyError(e); } }
async function removePump(id: number)   { try { await store.removePump(wellId(), id); } catch (e) { ui.notifyError(e); } }

async function submitMaintenance() {
  if (!maintForm.value.event_type_id) return;
  try {
    await maintenanceApi.create(wellId(), maintForm.value as any);
    ui.notify("บันทึกซ่อมบำรุงแล้ว", "success");
    showMaint.value = false;
    maintForm.value = { event_type_id: null, event_date: new Date().toISOString().slice(0, 10), description: "", performed_by: "", next_service_date: "", is_warranty_claim: false };
    await loadMaintenance();
  } catch (e) { ui.notifyError(e); }
}

async function deleteMaintenance(id: number) {
  try {
    await maintenanceApi.remove(id);
    ui.notify("ลบรายการแล้ว", "success");
    await loadMaintenance();
  } catch (e) { ui.notifyError(e); }
}

function downloadReport() { api.download(`/wells/${wellId()}/report.pdf`, `report-${wellId()}.pdf`).catch(e => ui.notifyError(e)); }

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function alertTier(w: any): "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" {
  const days = Number(w.warranty_remaining_days);
  if (w.warranty_status !== "IN_WARRANTY") return "EXPIRED";
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
          <div class="text-h6 font-display font-weight-bold">{{ store.current.job_title || `บ่อบาดาล #${store.current.well_id}` }}</div>
          <div class="text-caption text-medium-emphasis mt-1">
            <v-icon icon="mdi-map-marker-outline" size="14" />
            {{ store.current.site_address || store.current.province }}
            <span v-if="store.current.job_reference"> · {{ store.current.job_reference }}</span>
          </div>
        </div>
        <WarrantyBadge
          v-if="store.current.warranty_expire_date"
          :alert-tier="alertTier(store.current)"
          :remaining-days="Number(store.current.warranty_remaining_days)"
          :expiry-date="store.current.warranty_expire_date"
        />
      </div>

      <v-row dense>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">ความลึกรวม</div>
          <div class="font-mono font-weight-bold">{{ store.current.total_depth }} ม.</div>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">ปริมาณน้ำ</div>
          <div class="font-mono font-weight-bold">{{ store.current.water_quantity }} ม³/ชม.</div>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">ระดับน้ำนิ่ง</div>
          <div class="font-mono font-weight-bold">{{ store.current.static_water_level }} ม.</div>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">ระดับน้ำลด</div>
          <div class="font-mono font-weight-bold">{{ store.current.pumping_water_level }} ม.</div>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">วันเสร็จ</div>
          <div class="font-mono font-weight-bold">{{ fmtDate(store.current.completion_date) }}</div>
        </v-col>
        <v-col cols="6" sm="4" md="2">
          <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold">หมดประกัน</div>
          <div class="font-mono font-weight-bold">{{ fmtDate(store.current.warranty_expire_date ?? '') }}</div>
        </v-col>
      </v-row>

      <div v-if="store.current.notes" class="text-caption text-medium-emphasis mt-3 pt-3" style="border-top:1px solid rgba(128,128,128,0.15)">
        <v-icon icon="mdi-note-text-outline" size="14" class="mr-1" />{{ store.current.notes }}
      </div>

      <!-- GPS -->
      <div v-if="store.current.latitude" class="text-caption text-medium-emphasis mt-1">
        <v-icon icon="mdi-crosshairs-gps" size="14" class="mr-1" />
        {{ Number(store.current.latitude).toFixed(6) }}, {{ Number(store.current.longitude).toFixed(6) }}
      </div>
    </v-card>

    <!-- ===== Strata Visualizer ===== -->
    <SectionHeader title="ชั้นดิน / ชั้นหิน" icon="mdi-layers-outline" @add="showStrata = true" />
    <v-card class="pa-4 mb-4">
      <StrataColumn
        v-if="store.current.strata.length"
        :strata="(store.current.strata as any[])"
        :total-depth="Number(store.current.total_depth)"
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
          <span class="font-mono text-medium-emphasis" style="min-width:90px">{{ s.depth_from }}–{{ s.depth_to }} ม.</span>
          <span class="flex-grow-1 px-2">{{ s.lithology_name_th || s.lithology_name }}</span>
          <span v-if="s.is_water_bearing" class="text-primary mr-2">💧</span>
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
          <span class="font-mono text-caption text-medium-emphasis">{{ p.depth_from }}–{{ p.depth_to }} ม.</span>
          {{ " " }}{{ PIPE_TYPE[p.pipe_type as keyof typeof PIPE_TYPE] }}
          <span class="text-medium-emphasis">· {{ PIPE_SIZE[p.pipe_size as keyof typeof PIPE_SIZE] }} · {{ THICKNESS[p.thickness_class as keyof typeof THICKNESS] }}</span>
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
          <div>{{ PUMP_TYPE[p.pump_type as keyof typeof PUMP_TYPE] }} · {{ p.brand }}</div>
          <div class="text-caption text-medium-emphasis">
            {{ p.horsepower }} HP · {{ p.impeller_stages }} ใบพัด · หย่อนที่ {{ p.installation_depth }} ม. · ติดตั้ง {{ fmtDate(p.installed_date) }}
          </div>
        </div>
        <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" @click="removePump(p.pump_id)" />
      </div>
    </v-card>

    <!-- ===== Maintenance History ===== -->
    <SectionHeader title="ประวัติซ่อมบำรุง" icon="mdi-tools" @add="showMaint = true" />
    <v-card class="pa-4 mb-6">
      <MaintenanceTimeline
        :logs="maintenance"
        :loading="maintLoading"
        @delete="deleteMaintenance"
      />
    </v-card>

    <!-- Dialogs -->
    <StrataFormDialog v-model="showStrata" @submit="addStrata" />
    <PipeFormDialog   v-model="showPipe"   @submit="addPipe"   />
    <PumpFormDialog   v-model="showPump"   @submit="addPump"   />

    <!-- Maintenance Dialog -->
    <v-dialog v-model="showMaint" max-width="520" :persistent="true">
      <v-card>
        <v-card-title class="pa-4 font-display font-weight-bold">บันทึกซ่อมบำรุง</v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <v-select
            v-model="maintForm.event_type_id"
            :items="eventTypes"
            item-title="type_name_th"
            item-value="event_type_id"
            label="ประเภทงาน *"
            class="mb-3"
          />
          <v-text-field v-model="maintForm.event_date"       type="date" label="วันที่ซ่อม *" class="mb-3" />
          <v-textarea   v-model="maintForm.description"      label="รายละเอียดงาน *" rows="3"  class="mb-3" />
          <v-text-field v-model="maintForm.performed_by"     label="ช่าง / ผู้รับเหมา *"      class="mb-3" />
          <v-text-field v-model="maintForm.next_service_date" type="date" label="นัดครั้งต่อไป (ถ้ามี)" class="mb-3" />
          <v-checkbox   v-model="maintForm.is_warranty_claim" label="เป็นการเคลมประกัน" color="error" />
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4 ga-2">
          <v-spacer />
          <v-btn variant="text" @click="showMaint = false">ยกเลิก</v-btn>
          <v-btn color="primary" variant="flat" @click="submitMaintenance">บันทึก</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>

  <div v-else class="text-center py-10 text-medium-emphasis">
    <v-progress-circular indeterminate color="primary" class="mb-3" /><br />กำลังโหลด...
  </div>
</template>
