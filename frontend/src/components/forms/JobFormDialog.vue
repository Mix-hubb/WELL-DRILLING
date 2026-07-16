<script setup lang="ts">
import { ref, watch } from "vue";
import type { Customer } from "@/types";

const props = defineProps<{ modelValue: boolean; customers: Customer[] }>();
const emit  = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const empty = () => ({
  customer_id:      props.customers[0]?.customer_id ?? null,
  job_title:        "",
  site_address:     "",
  province:         "",
  district:         "",
  latitude:         "",
  longitude:        "",
  scheduled_date:   "",
  requested_depth_m:"",
  priority:         "NORMAL",
  notes:            "",
});
const form     = ref(empty());
const locating = ref(false);

watch(() => props.modelValue, (v) => { if (v) form.value = empty(); });

function useGPS() {
  if (!navigator.geolocation) return;
  locating.value = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.value.latitude  = pos.coords.latitude.toFixed(6);
      form.value.longitude = pos.coords.longitude.toFixed(6);
      locating.value = false;
    },
    () => { locating.value = false; }
  );
}

function submit() {
  if (!form.value.job_title || !form.value.site_address || !form.value.scheduled_date || !form.value.customer_id) return;
  emit("submit", {
    ...form.value,
    latitude:          Number(form.value.latitude)  || null,
    longitude:         Number(form.value.longitude) || null,
    requested_depth_m: Number(form.value.requested_depth_m) || 0,
  });
}

const priorityOpts = [
  { title: "ปกติ",       value: "NORMAL" },
  { title: "สำคัญ",     value: "HIGH"   },
  { title: "เร่งด่วน", value: "URGENT" },
];
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

        <v-row dense align="center" class="mb-1">
          <v-col cols="5"><v-text-field v-model="form.latitude"  type="number" label="ละติจูด" /></v-col>
          <v-col cols="5"><v-text-field v-model="form.longitude" type="number" label="ลองจิจูด" /></v-col>
          <v-col cols="2">
            <v-btn :loading="locating" icon="mdi-crosshairs-gps" variant="tonal" color="primary" @click="useGPS" />
          </v-col>
        </v-row>

        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.scheduled_date"    type="date"   label="วันที่นัดหมาย *" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.requested_depth_m" type="number" label="ความลึกที่ขอ (ม.)" /></v-col>
        </v-row>

        <v-select v-model="form.priority" :items="priorityOpts" label="ความสำคัญ" class="mt-1 mb-3" />
        <v-textarea v-model="form.notes" label="หมายเหตุ" rows="2" />
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 ga-2">
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn
          color="primary" variant="flat"
          :disabled="!form.job_title || !form.site_address || !form.scheduled_date || !form.customer_id"
          @click="submit"
        >สร้างคิวงาน</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
