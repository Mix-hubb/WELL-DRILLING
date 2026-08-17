<script setup lang="ts">
import { ref, watch } from "vue";
import { PROTECTION_TYPE } from "@/constants";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const protectionOptions = Object.entries(PROTECTION_TYPE).map(([value, title]) => ({ value, title }));

const empty = () => ({
  brand: "",
  model: "",
  capacity: "",
  voltage: "",
  protection_type: "",
  features: "",
  installed_date: new Date().toISOString().slice(0, 10),
  notes: "",
});
const form = ref(empty());

watch(() => props.modelValue, (v) => { if (v) form.value = empty(); });

function submit() {
  emit("submit", {
    brand:          form.value.brand || null,
    model:          form.value.model || null,
    capacity:       form.value.capacity || null,
    voltage:        form.value.voltage || null,
    protection_type: form.value.protection_type || null,
    features:       form.value.features || null,
    installed_date: form.value.installed_date || null,
    notes:          form.value.notes || null,
  });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="440">
    <v-card class="pa-2">
      <v-card-title class="font-display font-weight-bold">เพิ่มตู้คอนโทรล</v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.brand" label="ยี่ห้อ" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.model" label="รุ่น" /></v-col>
        </v-row>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.capacity" label="กำลัง (HP/kW)" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.voltage" label="แรงดัน (V)" /></v-col>
        </v-row>
        <v-select v-model="form.protection_type" :items="protectionOptions" label="ระบบป้องกัน" clearable class="mb-1" />
        <v-text-field v-model="form.features" label="อุปกรณ์ในตู้" placeholder="เช่น คอนแทคเตอร์, รีเลย์, เบรกเกอร์" class="mb-1" />
        <v-text-field v-model="form.installed_date" type="date" label="วันที่ติดตั้ง" class="mt-1" />
        <v-textarea v-model="form.notes" label="หมายเหตุ" rows="2" class="mt-1" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn color="primary" variant="flat" @click="submit">บันทึก</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
