<script setup lang="ts">
import { ref, watch } from "vue";
import type { Customer } from "@/types";

const props = defineProps<{ modelValue: boolean; customers: Customer[] }>();
const emit  = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const empty = () => ({
  customer_id:    props.customers[0]?.customer_id ?? null,
  job_title:      "",
  site_address:   "",
  province:       "",
  district:       "",
  scheduled_date: "",
  notes:          "",
});
const form = ref(empty());

watch(() => props.modelValue, (v) => { if (v) form.value = empty(); });

function submit() {
  if (!form.value.job_title || !form.value.site_address || !form.value.customer_id) return;
  emit("submit", {
    ...form.value,
    scheduled_date: form.value.scheduled_date || null,
    notes:          form.value.notes || null,
  });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="640">
    <v-card>
      <v-card-title class="pa-4 font-display font-weight-bold">สร้างคิวงานใหม่</v-card-title>
      <v-divider />
      <v-card-text class="pa-4">
        <v-select
          v-model="form.customer_id"
          :items="customers"
          item-title="customer_name"
          item-value="customer_id"
          label="ลูกค้า *"
          class="mb-3"
        />
        <v-text-field v-model="form.job_title" label="หัวข้องาน *" class="mb-3" />
        <v-textarea   v-model="form.site_address" label="ที่ตั้งหน้างาน *" rows="2" class="mb-3" />

        <v-row dense class="mb-1">
          <v-col cols="6"><v-text-field v-model="form.province" label="จังหวัด" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.district" label="อำเภอ" /></v-col>
        </v-row>

        <v-text-field v-model="form.scheduled_date" type="date" label="วันที่นัดหมาย (ว่าง = อยู่ในคิว)" class="mb-3" />

        <v-textarea v-model="form.notes" label="หมายเหตุ" rows="2" />
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 ga-2">
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn
          color="primary" variant="flat"
          :disabled="!form.job_title || !form.site_address || !form.customer_id"
          @click="submit"
        >สร้างคิวงาน</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
