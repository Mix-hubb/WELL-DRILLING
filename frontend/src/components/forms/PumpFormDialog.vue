<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { PUMP_TYPE } from "@/constants";
import { pumpCatalogApi } from "@/api/pumpCatalog";
import type { PumpType, PumpCatalogModel } from "@/types";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const typeOptions = Object.entries(PUMP_TYPE).map(([value, title]) => ({ value, title }));

const catalogModels = ref<PumpCatalogModel[]>([]);
const catalogSearch = ref("");
const selectedCatalog = ref<PumpCatalogModel | null>(null);

async function loadCatalog() {
  try {
    const data = await pumpCatalogApi.list({ includeInactive: false });
    catalogModels.value = data.map((m) => ({ ...m, brand_model: `${m.brand} - ${m.model}` }));
  } catch { catalogModels.value = []; }
}

onMounted(loadCatalog);

const filteredCatalog = ref<PumpCatalogModel[]>([]);
watch(catalogSearch, (q) => {
  if (!q || q.length < 1) { filteredCatalog.value = catalogModels.value.slice(0, 20); return; }
  const lower = q.toLowerCase();
  filteredCatalog.value = catalogModels.value.filter(
    (m) => m.brand.toLowerCase().includes(lower) || m.model.toLowerCase().includes(lower)
  ).slice(0, 20);
});

function selectCatalog(model: PumpCatalogModel) {
  selectedCatalog.value = model;
  catalogSearch.value = `${model.brand} - ${model.model}`;
  filteredCatalog.value = [];
}

const empty = () => ({
  pump_type: "AC_SUBMERSIBLE" as PumpType,
  installation_depth_m: "",
  installed_date: new Date().toISOString().slice(0, 10),
});
const form = ref(empty());

function submit() {
  if (!form.value.installation_depth_m || !selectedCatalog.value) return;
  const m = selectedCatalog.value;
  emit("submit", {
    pump_type: form.value.pump_type,
    brand: m.brand || null,
    pump_model: m.model || null,
    horsepower: m.motor_power ? Number(String(m.motor_power).match(/[\d.]+/)?.[0]) : null,
    power_kw: null,
    impeller_stages: m.impeller_stages ? Number(String(m.impeller_stages).match(/\d+/)?.[0]) : null,
    installation_depth_m: Number(form.value.installation_depth_m),
    voltage: null,
    phase: m.phase?.includes("3") ? 3 : 1,
    discharge_size_mm: m.discharge_size ? Number(String(m.discharge_size).match(/\d+/)?.[0]) : null,
    rated_flow_m3hr: m.flow_rate ? Number(String(m.flow_rate).match(/[\d.]+/)?.[0]) : null,
    rated_head_m: m.max_head_m ? Number(String(m.max_head_m).match(/[\d.]+/)?.[0]) : null,
    installed_date: form.value.installed_date || new Date().toISOString().slice(0, 10),
  });
}

watch(() => props.modelValue, (v) => {
  if (v) {
    form.value = empty();
    selectedCatalog.value = null;
    catalogSearch.value = "";
    filteredCatalog.value = [];
  }
});
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="480">
    <v-card class="pa-2">
      <v-card-title class="font-display font-weight-bold">เพิ่มข้อมูลปั๊ม</v-card-title>
      <v-card-text>
        <v-select v-model="form.pump_type" :items="typeOptions" label="ประเภทปั๊ม" class="mb-3" />

        <v-autocomplete
          v-model="catalogSearch"
          :items="filteredCatalog"
          label="ค้นหาจากแคตตาล็อกปั๊ม (พิมพ์ยี่ห้อหรือรุ่น)"
          placeholder="เช่น Franklin, TORQUE"
          item-title="brand_model"
          item-value="brand_model"
          variant="outlined"
          density="comfortable"
          clearable
          no-filter
          class="mb-1"
          @update:model-value="(val: any) => {
            if (val && typeof val === 'object') selectCatalog(val);
            else if (typeof val === 'string') catalogSearch = val;
          }"
          @click:clear="selectedCatalog = null; catalogSearch = ''; filteredCatalog = catalogModels.slice(0, 20);"
        >
          <template #item="{ item, props }">
            <v-list-item v-bind="props">
              <template #title>
                <span class="font-weight-bold">{{ (item as any).raw?.brand }} - {{ (item as any).raw?.model }}</span>
              </template>
              <template #subtitle>
                <span class="text-caption">
                  <template v-if="(item as any).raw?.motor_power">มอเตอร์ {{ (item as any).raw?.motor_power }}</template>
                  <template v-if="(item as any).raw?.phase"> · เฟส {{ (item as any).raw?.phase }}</template>
                  <template v-if="(item as any).raw?.impeller_stages"> · ใบพัด {{ (item as any).raw?.impeller_stages }}</template>
                  <template v-if="(item as any).raw?.max_head_m"> · เฮด {{ (item as any).raw?.max_head_m }}</template>
                </span>
              </template>
            </v-list-item>
          </template>
        </v-autocomplete>

        <div v-if="selectedCatalog" class="mb-3 pa-3 rounded-lg" style="background: #FDFBF7; border: 1px solid #E2D9CC;">
          <div class="text-caption font-weight-bold mb-1" style="color: #2E2418;">
            {{ selectedCatalog.brand }} - {{ selectedCatalog.model }}
          </div>
          <div class="text-caption d-flex flex-wrap ga-2">
            <template v-if="selectedCatalog.motor_power"><span>มอเตอร์ {{ selectedCatalog.motor_power }}</span></template>
            <template v-if="selectedCatalog.phase"><span>เฟส {{ selectedCatalog.phase }}</span></template>
            <template v-if="selectedCatalog.impeller_stages"><span>ใบพัด {{ selectedCatalog.impeller_stages }}</span></template>
            <template v-if="selectedCatalog.max_head_m"><span>เฮด {{ selectedCatalog.max_head_m }}</span></template>
            <template v-if="selectedCatalog.flow_rate"><span>ไหล {{ selectedCatalog.flow_rate }}</span></template>
          </div>
        </div>

        <v-text-field v-model="form.installation_depth_m" type="number" label="หย่อนปั๊มที่ (ม.) *" class="mb-1" />
        <v-text-field v-model="form.installed_date" type="date" label="วันที่ติดตั้ง" class="mt-1" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!form.installation_depth_m || !selectedCatalog" @click="submit">เพิ่มปั๊ม</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
