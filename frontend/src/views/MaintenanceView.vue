<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { maintenanceApi, type OverdueRecord, type MaintenanceEventType } from "@/api/maintenance";
import { useUiStore } from "@/stores/ui";

const ui     = useUiStore();
const router = useRouter();

const overdue     = ref<OverdueRecord[]>([]);
const eventTypes  = ref<MaintenanceEventType[]>([]);
const loading     = ref(true);

/* ---- Add dialog ---- */
const showAdd  = ref(false);
const wellIdTarget = ref<number | null>(null);
const form     = ref({
  event_type_id: null as number | null,
  event_date: new Date().toISOString().slice(0, 10),
  description: "",
  performed_by: "",
  next_service_date: "",
  is_warranty_claim: false,
});

async function load() {
  loading.value = true;
  try {
    const [od, et] = await Promise.all([
      maintenanceApi.listOverdue(),
      maintenanceApi.listEventTypes(),
    ]);
    overdue.value    = od;
    eventTypes.value = et;
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

async function submitAdd() {
  if (!wellIdTarget.value || !form.value.event_type_id) return;
  try {
    await maintenanceApi.create(wellIdTarget.value, form.value as any);
    ui.notify("บันทึกซ่อมบำรุงแล้ว", "success");
    showAdd.value = false;
    form.value = { event_type_id: null, event_date: new Date().toISOString().slice(0, 10), description: "", performed_by: "", next_service_date: "", is_warranty_claim: false };
    await load();
  } catch (e) {
    ui.notifyError(e);
  }
}

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}
function openAdd(wellId: number) {
  wellIdTarget.value = wellId;
  showAdd.value = true;
}
</script>

<template>
  <div style="max-width:860px">
    <h1 class="text-h5 font-display font-weight-bold mb-4">ประวัติซ่อมบำรุง / นัดเลย</h1>

    <div v-if="loading" class="text-center py-10 text-medium-emphasis">
      <v-progress-circular indeterminate color="primary" class="mb-3" /><br />กำลังโหลด...
    </div>

    <!-- Overdue List -->
    <template v-else>
      <v-card class="mb-5" v-if="overdue.length">
        <v-card-title class="d-flex align-center ga-2 pa-4">
          <v-icon icon="mdi-alert-circle-outline" color="error" />
          <span class="text-body-1 font-weight-semibold">เลยนัดซ่อมบำรุง ({{ overdue.length }} รายการ)</span>
        </v-card-title>
        <v-divider />
        <div
          v-for="r in overdue" :key="r.maintenance_id"
          class="pa-4 d-flex justify-space-between align-center flex-wrap ga-2"
          style="border-bottom:1px solid rgba(0,0,0,0.07)"
        >
          <div>
            <div class="font-weight-medium">{{ r.customer_name }}</div>
            <div class="text-caption text-medium-emphasis">
              {{ r.job_reference }} · {{ r.province }} · {{ r.event_type_name }}
            </div>
            <div class="text-caption mt-1">
              <span class="text-error font-weight-medium">เลยกำหนด {{ r.days_overdue }} วัน</span>
              · นัดไว้: {{ fmtDate(r.next_service_date ?? '') }}
            </div>
          </div>
          <div class="d-flex ga-2">
            <v-btn
              size="small" variant="tonal" color="primary"
              prepend-icon="mdi-plus"
              @click="openAdd(r.well_id)"
            >บันทึกซ่อม</v-btn>
            <v-btn
              size="small" variant="text"
              prepend-icon="mdi-eye-outline"
              @click="router.push(`/wells/${r.well_id}`)"
            >ดูบ่อ</v-btn>
          </div>
        </div>
      </v-card>

      <div v-else class="text-center py-8 text-medium-emphasis">
        <v-icon icon="mdi-check-circle-outline" color="success" size="48" class="mb-2" />
        <div>ไม่มีรายการเลยกำหนดซ่อมบำรุง 🎉</div>
      </div>
    </template>

    <!-- Add Maintenance Dialog -->
    <v-dialog v-model="showAdd" max-width="520" :persistent="true">
      <v-card>
        <v-card-title class="pa-4 font-display font-weight-bold">บันทึกซ่อมบำรุง</v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <v-select
            v-model="form.event_type_id"
            :items="eventTypes"
            item-title="type_name_th"
            item-value="event_type_id"
            label="ประเภทงาน *"
            class="mb-3"
          />
          <v-text-field v-model="form.event_date"  type="date" label="วันที่ซ่อม *" class="mb-3" />
          <v-textarea  v-model="form.description"  label="รายละเอียดงาน *" rows="3" class="mb-3" />
          <v-text-field v-model="form.performed_by" label="ช่าง / ผู้รับเหมา *" class="mb-3" />
          <v-text-field v-model="form.next_service_date" type="date" label="นัดครั้งต่อไป (ถ้ามี)" class="mb-3" />
          <v-checkbox v-model="form.is_warranty_claim" label="เป็นการเคลมประกัน" color="error" />
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4 ga-2">
          <v-spacer />
          <v-btn variant="text" @click="showAdd = false">ยกเลิก</v-btn>
          <v-btn color="primary" variant="flat" @click="submitAdd">บันทึก</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
