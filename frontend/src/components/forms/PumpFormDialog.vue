<script setup lang="ts">
import { ref, watch } from "vue";
import { PUMP_TYPE } from "@/constants";
import PumpCatalogPicker from "@/components/PumpCatalogPicker.vue";
import { deriveCatalogPumpFields } from "@/utils/pumpCatalog";
import type { PumpCatalogModel, PumpType } from "@/types";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const typeOptions = Object.entries(PUMP_TYPE).map(([value, title]) => ({ value, title }));

const empty = () => ({
  pump_type: "AC_SUBMERSIBLE" as PumpType,
  brand: "",
  pump_model: "",
  horsepower: null as number | null,
  power_kw: null as number | null,
  impeller_stages: null as number | null,
  voltage: null as string | null,
  phase: null as number | null,
  discharge_size_mm: null as number | null,
  rated_head_m: null as number | null,
  installed_date: new Date().toISOString().slice(0, 10),
});
const form = ref(empty());
const catalogModel = ref<PumpCatalogModel | null>(null);

watch(() => props.modelValue, (v) => { if (v) { form.value = empty(); catalogModel.value = null; } });

function onCatalogSelect(model: PumpCatalogModel | null) {
  catalogModel.value = model;
  if (!model) return;
  Object.assign(form.value, deriveCatalogPumpFields(model));
}

function submit() {
  if (!form.value.pump_model) return;
  emit("submit", {
    ...form.value,
    installation_depth_m: null,
    rated_flow_m3hr: null,
    installed_date: form.value.installed_date || new Date().toISOString().slice(0, 10),
  });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="480">
    <v-card class="pa-2">
      <v-card-title class="font-display font-weight-bold">เพิ่มข้อมูลปั๊ม</v-card-title>
      <v-card-text>
        <v-select v-model="form.pump_type" :items="typeOptions" label="ประเภทปั๊ม" class="mb-3" />
        <PumpCatalogPicker :model-value="catalogModel" label="รุ่นปั๊ม" @update:model-value="onCatalogSelect" />
        <v-text-field v-model="form.installed_date" type="date" label="วันที่ติดตั้ง" class="mt-3" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!form.pump_model" @click="submit">เพิ่มปั๊ม</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
