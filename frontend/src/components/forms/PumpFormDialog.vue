<script setup lang="ts">
import { ref, watch } from "vue";
import { PUMP_TYPE } from "@/constants";
import type { PumpType } from "@/types";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const typeOptions = Object.entries(PUMP_TYPE).map(([value, title]) => ({ value, title }));

const empty = () => ({ pump_type: "AC_SUBMERSIBLE" as PumpType, brand: "", horsepower: "", impeller_stages: "", installation_depth: "", installed_date: "" });
const form = ref(empty());

watch(() => props.modelValue, (v) => { if (v) form.value = empty(); });

function submit() {
  if (!form.value.horsepower || !form.value.installation_depth) return;
  emit("submit", {
    pump_type: form.value.pump_type,
    brand: form.value.brand,
    horsepower: Number(form.value.horsepower),
    impeller_stages: Number(form.value.impeller_stages) || 0,
    installation_depth: Number(form.value.installation_depth),
    installed_date: form.value.installed_date || new Date().toISOString().slice(0, 10),
  });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="440">
    <v-card class="pa-2">
      <v-card-title class="font-display font-weight-bold">เพิ่มข้อมูลปั๊ม</v-card-title>
      <v-card-text>
        <v-select v-model="form.pump_type" :items="typeOptions" label="ประเภทปั๊ม" class="mb-1" />
        <v-text-field v-model="form.brand" label="ยี่ห้อ/รุ่น" class="mb-1" />
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.horsepower" type="number" label="กำลัง (HP)" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.impeller_stages" type="number" label="จำนวนใบพัด" /></v-col>
        </v-row>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.installation_depth" type="number" label="ความลึกติดตั้ง (ม.)" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.installed_date" type="date" label="วันที่ติดตั้ง" /></v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!form.horsepower || !form.installation_depth" @click="submit">เพิ่มปั๊ม</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
