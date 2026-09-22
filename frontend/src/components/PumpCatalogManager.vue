<script setup lang="ts">
import { ref, computed } from "vue";
import { pumpCatalogApi } from "@/api/pumpCatalog";
import { useUiStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { useSSERefresh } from "@/composables/useSSERefresh";
import { money } from "@/constants";
import type { PumpCatalogModel } from "@/types";

const ui = useUiStore();
const auth = useAuthStore();
const models = ref<PumpCatalogModel[]>([]);
const loading = ref(true);
const search = ref("");
const selectedBrand = ref<string>("ALL");

// Dialogs
const showDialog = ref(false);
const editingModel = ref<PumpCatalogModel | null>(null);
const deleteConfirmDialog = ref(false);
const modelToDelete = ref<PumpCatalogModel | null>(null);

const form = ref({
  brand: "",
  series: "",
  model: "",
  motor_power: "",
  phase: "1 Phase (220V)",
  bore_size: "4 นิ้ว",
  discharge_size: "1.5 นิ้ว",
  impeller_stages: "",
  max_head_m: "",
  flow_rate: "",
  material: "สแตนเลส (AISI 304)",
  features: "",
  reference_price: null as number | null,
  notes: "",
  is_active: true,
});

const brands = computed(() => {
  const set = new Set<string>();
  for (const m of models.value) {
    if (m.brand) set.add(m.brand);
  }
  return ["ALL", ...Array.from(set).sort()];
});

const filteredModels = computed(() => {
  let list = models.value;
  if (selectedBrand.value !== "ALL") {
    list = list.filter((m) => m.brand === selectedBrand.value);
  }
  const q = search.value.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (m) =>
      m.brand.toLowerCase().includes(q) ||
      m.model.toLowerCase().includes(q) ||
      (m.series || "").toLowerCase().includes(q) ||
      (m.motor_power || "").toLowerCase().includes(q)
  );
});

async function load() {
  try {
    loading.value = true;
    models.value = await pumpCatalogApi.list({ includeInactive: true });
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
}

useSSERefresh(load, [
  "PUMP_CATALOG_CREATED",
  "PUMP_CATALOG_UPDATED",
  "PUMP_CATALOG_DELETED",
]);

function openAddDialog() {
  editingModel.value = null;
  form.value = {
    brand: selectedBrand.value !== "ALL" ? selectedBrand.value : "FRANKLIN",
    series: "",
    model: "",
    motor_power: "1.5 HP",
    phase: "1 Phase (220V)",
    bore_size: "4 นิ้ว",
    discharge_size: "1.5 นิ้ว",
    impeller_stages: "",
    max_head_m: "",
    flow_rate: "",
    material: "สแตนเลส (AISI 304)",
    features: "",
    reference_price: null,
    notes: "",
    is_active: true,
  };
  showDialog.value = true;
}

function openEditDialog(m: PumpCatalogModel) {
  editingModel.value = m;
  form.value = {
    brand: m.brand || "",
    series: m.series || "",
    model: m.model || "",
    motor_power: m.motor_power || "",
    phase: m.phase || "",
    bore_size: m.bore_size || "",
    discharge_size: m.discharge_size || "",
    impeller_stages: m.impeller_stages || "",
    max_head_m: m.max_head_m || "",
    flow_rate: m.flow_rate || "",
    material: m.material || "",
    features: m.features || "",
    reference_price: m.reference_price ?? null,
    notes: m.notes || "",
    is_active: !!m.is_active,
  };
  showDialog.value = true;
}

function confirmDelete(m: PumpCatalogModel) {
  modelToDelete.value = m;
  deleteConfirmDialog.value = true;
}

async function handleSave() {
  if (!form.value.brand.trim() || !form.value.model.trim()) return;
  try {
    const payload = {
      ...form.value,
      reference_price: form.value.reference_price != null ? Number(form.value.reference_price) : null,
    };
    if (editingModel.value?.model_id) {
      await pumpCatalogApi.update(editingModel.value.model_id, payload as any);
      ui.notify("บันทึกการแก้ไขรุ่นปั๊มแล้ว", "success");
    } else {
      await pumpCatalogApi.create(payload as any);
      ui.notify("เพิ่มรุ่นปั๊มน้ำใหม่แล้ว", "success");
    }
    showDialog.value = false;
    await load();
  } catch (e) {
    ui.notifyError(e);
  }
}

async function handleDelete() {
  if (!modelToDelete.value?.model_id) return;
  try {
    await pumpCatalogApi.remove(modelToDelete.value.model_id);
    ui.notify("ลบรุ่นปั๊มน้ำเรียบร้อยแล้ว", "success");
    deleteConfirmDialog.value = false;
    modelToDelete.value = null;
    await load();
  } catch (e) {
    ui.notifyError(e);
  }
}
</script>

<template>
  <div>
    <!-- Top toolbar -->
    <div class="d-flex flex-wrap align-center justify-space-between ga-3 mb-4">
      <div class="d-flex align-center ga-2 flex-grow-1" style="max-width: 400px">
        <v-text-field
          v-model="search"
          density="compact"
          variant="outlined"
          hide-details
          prepend-inner-icon="mdi-magnify"
          placeholder="ค้นหาชื่อรุ่น ยี่ห้อ หรือซีรีส์..."
        />
      </div>
      <v-btn
        v-if="auth.isAdmin"
        color="primary"
        variant="flat"
        prepend-icon="mdi-plus"
        @click="openAddDialog"
      >
        เพิ่มรุ่นปั๊มน้ำ
      </v-btn>
    </div>

    <!-- Brand Filter Chips -->
    <div class="d-flex align-center flex-wrap ga-2 mb-4">
      <span class="text-caption text-medium-emphasis mr-1">ยี่ห้อ:</span>
      <v-chip
        v-for="b in brands"
        :key="b"
        size="small"
        :variant="selectedBrand === b ? 'flat' : 'outlined'"
        :color="selectedBrand === b ? 'primary' : undefined"
        class="cursor-pointer"
        @click="selectedBrand = b"
      >
        {{ b === "ALL" ? "ทั้งหมด" : b }}
      </v-chip>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8 text-medium-emphasis">
      <v-progress-circular indeterminate color="primary" class="mb-2" /><br />
      กำลังโหลดแคตตาล็อกปั๊ม...
    </div>

    <!-- Models List -->
    <div v-else-if="filteredModels.length" class="d-flex flex-column ga-3">
      <v-card
        v-for="m in filteredModels"
        :key="m.model_id"
        variant="outlined"
        class="pa-4"
        :style="!m.is_active ? 'opacity: 0.6;' : ''"
      >
        <div class="d-flex align-start justify-space-between flex-wrap ga-2 mb-2">
          <div>
            <div class="d-flex align-center ga-2 flex-wrap">
              <span class="text-subtitle-1 font-weight-bold">{{ m.brand }} - {{ m.model }}</span>
              <v-chip v-if="m.series" size="x-small" variant="tonal" color="info">
                {{ m.series }}
              </v-chip>
              <v-chip v-if="!m.is_active" size="x-small" color="grey" variant="flat">
                ปิดการใช้งาน
              </v-chip>
            </div>
            <div class="text-caption text-medium-emphasis mt-1 d-flex flex-wrap ga-3">
              <span v-if="m.motor_power"><v-icon icon="mdi-flash-outline" size="14" /> กำลัง: {{ m.motor_power }}</span>
              <span v-if="m.phase"><v-icon icon="mdi-sine-wave" size="14" /> ระบบไฟ: {{ m.phase }}</span>
              <span v-if="m.bore_size"><v-icon icon="mdi-circle-outline" size="14" /> ขนาดบ่อ: {{ m.bore_size }}</span>
              <span v-if="m.discharge_size"><v-icon icon="mdi-pipe" size="14" /> ท่อส่ง: {{ m.discharge_size }}</span>
              <span v-if="m.max_head_m"><v-icon icon="mdi-arrow-up-bold" size="14" /> เฮดสูงสุด: {{ m.max_head_m }}</span>
              <span v-if="m.flow_rate"><v-icon icon="mdi-water" size="14" /> ปริมาณน้ำ: {{ m.flow_rate }}</span>
            </div>
          </div>
          <div class="d-flex align-center ga-2">
            <div v-if="m.reference_price" class="text-subtitle-2 font-weight-bold text-success mr-2">
              ฿{{ money(m.reference_price) }}
            </div>
            <template v-if="auth.isAdmin">
              <v-btn icon="mdi-pencil-outline" size="small" variant="text" @click="openEditDialog(m)" />
              <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" @click="confirmDelete(m)" />
            </template>
          </div>
        </div>

        <div v-if="m.features" class="text-caption text-medium-emphasis mt-1">
          <strong>คุณสมบัติ:</strong> {{ m.features }}
        </div>
      </v-card>
    </div>

    <div v-else class="text-center py-10 text-medium-emphasis">
      ไม่พบรุ่นปั๊มน้ำ
    </div>

    <!-- Add/Edit Dialog -->
    <v-dialog v-model="showDialog" max-width="640">
      <v-card>
        <v-card-title class="pa-4 font-display font-weight-bold">
          {{ editingModel ? "แก้ไขรุ่นปั๊มน้ำ" : "เพิ่มรุ่นปั๊มน้ำใหม่" }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.brand" label="ยี่ห้อ (Brand) *" placeholder="เช่น FRANKLIN, TORISHIMA" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.series" label="ซีรีส์ (Series)" placeholder="เช่น FPS 4400, SP" />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="form.model" label="ชื่อรุ่น (Model) *" placeholder="เช่น 10FPS05S4-2W230" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.motor_power" label="กำลังมอเตอร์" placeholder="เช่น 1.5 HP, 1.1 kW" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.phase" label="ระบบไฟฟ้า" placeholder="เช่น 1 Phase (220V), 3 Phase" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.bore_size" label="ขนาดบ่อบาดาล" placeholder="เช่น 4 นิ้ว, 6 นิ้ว" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.discharge_size" label="ขนาดท่อส่ง" placeholder="เช่น 1.5 นิ้ว, 2 นิ้ว" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.max_head_m" label="ระยะส่งสูงสุด (Max Head)" placeholder="เช่น 75 ม." />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.flow_rate" label="ปริมาณน้ำ (Flow Rate)" placeholder="เช่น 2-5 ลบ.ม./ชม." />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.impeller_stages" label="จำนวนใบพัด (Stages)" placeholder="เช่น 8 ใบพัด" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.material" label="วัสดุตัวเรือน" placeholder="เช่น สแตนเลส 304" />
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field v-model="form.reference_price" type="number" label="ราคาอ้างอิง (บาท)" placeholder="เช่น 18500" />
            </v-col>
            <v-col cols="12" sm="6" class="d-flex align-center">
              <v-switch v-model="form.is_active" label="เปิดใช้งานในระบบ" color="primary" hide-details />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="form.features" label="จุดเด่น / รายละเอียดพิเศษ" rows="2" />
            </v-col>
            <v-col cols="12">
              <v-textarea v-model="form.notes" label="หมายเหตุภายใน" rows="2" />
            </v-col>
          </v-row>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4 ga-2">
          <v-spacer />
          <v-btn variant="text" @click="showDialog = false">ยกเลิก</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :disabled="!form.brand.trim() || !form.model.trim()"
            @click="handleSave"
          >
            {{ editingModel ? "บันทึกการแก้ไข" : "เพิ่มรุ่นปั๊ม" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirm Dialog -->
    <v-dialog v-model="deleteConfirmDialog" max-width="420">
      <v-card>
        <v-card-title class="pa-4 font-display font-weight-bold text-error">
          ยืนยันการลบรุ่นปั๊ม
        </v-card-title>
        <v-card-text class="pa-4">
          คุณต้องการลบ <strong>{{ modelToDelete?.brand }} - {{ modelToDelete?.model }}</strong> ออกจากแคตตาล็อกหรือไม่?
        </v-card-text>
        <v-card-actions class="pa-4 ga-2">
          <v-spacer />
          <v-btn variant="text" @click="deleteConfirmDialog = false">ยกเลิก</v-btn>
          <v-btn color="error" variant="flat" @click="handleDelete">ลบข้อมูล</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
