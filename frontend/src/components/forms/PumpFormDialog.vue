<script setup lang="ts">
import { ref, watch } from "vue";
import { PUMP_TYPE, PUMP_BRAND } from "@/constants";
import type { PumpType } from "@/types";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const typeOptions = Object.entries(PUMP_TYPE).map(([value, title]) => ({ value, title }));
const brandOptions = Object.entries(PUMP_BRAND).map(([value, title]) => ({ value, title }));
const phaseOptions = [
  { value: 1, title: "1 เฟส" },
  { value: 3, title: "3 เฟส" },
];

const empty = () => ({
  pump_type: "AC_SUBMERSIBLE" as PumpType,
  brand: "",
  pump_model: "",
  horsepower: "",
  power_kw: "",
  impeller_stages: "",
  installation_depth_m: "",
  voltage: "",
  phase: null as number | null,
  discharge_size_mm: "",
  rated_flow_m3hr: "",
  rated_head_m: "",
  installed_date: new Date().toISOString().slice(0, 10),
});
const form = ref(empty());

watch(() => props.modelValue, (v) => { if (v) form.value = empty(); });

function submit() {
  if (!form.value.horsepower || !form.value.installation_depth_m) return;
  emit("submit", {
    pump_type: form.value.pump_type,
    brand: form.value.brand || null,
    pump_model: form.value.pump_model || null,
    horsepower: Number(form.value.horsepower),
    power_kw: form.value.power_kw ? Number(form.value.power_kw) : null,
    impeller_stages: Number(form.value.impeller_stages) || null,
    installation_depth_m: Number(form.value.installation_depth_m),
    voltage: form.value.voltage || null,
    phase: form.value.phase ?? null,
    discharge_size_mm: form.value.discharge_size_mm ? Number(form.value.discharge_size_mm) : null,
    rated_flow_m3hr: form.value.rated_flow_m3hr ? Number(form.value.rated_flow_m3hr) : null,
    rated_head_m: form.value.rated_head_m ? Number(form.value.rated_head_m) : null,
    installed_date: form.value.installed_date || new Date().toISOString().slice(0, 10),
  });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="480">
    <v-card class="pa-2">
      <v-card-title class="font-display font-weight-bold">เพิ่มข้อมูลปั๊ม</v-card-title>
      <v-card-text>
        <v-select v-model="form.pump_type" :items="typeOptions" label="ประเภทปั๊ม" class="mb-1" />
        <v-autocomplete
          v-model="form.brand"
          :items="brandOptions"
          label="ยี่ห้อปั๊ม"
          placeholder="เลือกหรือพิมพ์ยี่ห้อ เช่น Franklin, TORQUE"
          clearable
          class="mb-1"
        />
        <v-text-field v-model="form.pump_model" label="รุ่น" class="mb-1" />
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.horsepower" type="number" label="กำลัง (HP)" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.power_kw" type="number" label="กำลัง (kW)" /></v-col>
        </v-row>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.impeller_stages" type="number" label="จำนวนใบพัด" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.installation_depth_m" type="number" label="หย่อนปั๊มที่ (ม.)" /></v-col>
        </v-row>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.voltage" label="แรงดันไฟ (V)" /></v-col>
          <v-col cols="6"><v-select v-model="form.phase" :items="phaseOptions" label="เฟส" clearable /></v-col>
        </v-row>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.discharge_size_mm" type="number" label="ท่อจ่าย (มม.)" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.rated_flow_m3hr" type="number" label="อัตราการไหล (ม³/ชม.)" /></v-col>
        </v-row>
        <v-text-field v-model="form.rated_head_m" type="number" label="เฮดปั๊ม (ม.)" class="mb-1" />
        <v-text-field v-model="form.installed_date" type="date" label="วันที่ติดตั้ง" class="mt-1" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!form.horsepower || !form.installation_depth_m" @click="submit">เพิ่มปั๊ม</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
