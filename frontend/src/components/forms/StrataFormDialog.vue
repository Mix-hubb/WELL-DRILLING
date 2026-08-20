<script setup lang="ts">
import { ref, watch } from "vue";
import { HARDNESS, LITHOLOGY_TYPE, LITHOLOGY_COLOR } from "@/constants";

const props = defineProps<{ modelValue: boolean }>();
const emit  = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const hardnessOptions = Object.entries(HARDNESS).map(([value, title]) => ({ value, title }));
const lithologyOptions = Object.entries(LITHOLOGY_TYPE).map(([value, title]) => ({ value, title }));

const empty = () => ({
  depth_from_m: "" as string | number,
  depth_to_m:   "" as string | number,
  lithology_type: "" as string,
  lithology_name: "",
  color_hex: "#A0856C",
  water_bearing: false,
  hardness: "" as string | null,
  description: "",
});
const form = ref(empty());
const showAdvanced = ref(false);

watch(() => props.modelValue, (v) => { if (v) { form.value = empty(); showAdvanced.value = false; } });

function onTypeChange(type: string) {
  const t = type as keyof typeof LITHOLOGY_TYPE;
  if (LITHOLOGY_TYPE[t]) {
    form.value.lithology_name = LITHOLOGY_TYPE[t];
    form.value.color_hex = LITHOLOGY_COLOR[t] || "#A0856C";
  }
}

function submit() {
  if (!form.value.depth_from_m || !form.value.depth_to_m || !form.value.lithology_name) return;
  emit("submit", {
    depth_from_m:   Number(form.value.depth_from_m),
    depth_to_m:     Number(form.value.depth_to_m),
    lithology_name: form.value.lithology_name,
    color_hex:      form.value.color_hex || null,
    water_bearing:  form.value.water_bearing ? 1 : 0,
    hardness:       form.value.hardness || null,
    description:    form.value.description || null,
  });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="480">
    <v-card>
      <v-card-title class="pa-4 font-display font-weight-bold">เพิ่มช่วงชั้นดิน / หิน</v-card-title>
      <v-divider />
      <v-card-text class="pa-4">
        <v-row dense class="mb-1">
          <v-col cols="6">
            <v-text-field v-model="form.depth_from_m" type="number" label="ความลึกเริ่ม (ม.) *" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.depth_to_m" type="number" label="ความลึกสิ้นสุด (ม.) *" />
          </v-col>
        </v-row>

        <v-row dense class="mb-1">
          <v-col cols="12">
            <v-autocomplete
              v-model="form.lithology_type"
              :items="lithologyOptions"
              label="ประเภทดิน / หิน *"
              placeholder="เช่น ดินลูกรัง, หินทราย, กรวด"
              clearable
              @update:model-value="onTypeChange"
            />
          </v-col>
        </v-row>

        <v-row dense class="mb-1">
          <v-col cols="8">
            <v-text-field v-model="form.lithology_name" label="ชื่อชั้น *" placeholder="เช่น ดินลูกรัง, หินทราย, กรวด" />
          </v-col>
          <v-col cols="4">
            <v-text-field v-model="form.color_hex" label="สี" type="color" />
          </v-col>
        </v-row>

        <v-checkbox v-model="form.water_bearing" label="💧 ชั้นน้ำบาดาล" color="primary" hide-details class="mb-2" />

        <!-- Advanced toggle -->
        <v-btn
          variant="text" size="small" color="primary"
          :append-icon="showAdvanced ? 'mdi-chevron-up' : 'mdi-chevron-down'"
          @click="showAdvanced = !showAdvanced"
          class="mb-2"
        >ข้อมูลอุทกธรณีวิทยา</v-btn>

        <div v-if="showAdvanced">
          <v-select v-model="form.hardness" :items="hardnessOptions" label="ความแข็ง" clearable class="mb-2" />
        </div>

        <v-text-field v-model="form.description" label="หมายเหตุช่าง" class="mt-1" />
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 ga-2">
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn
          color="primary" variant="flat"
          :disabled="!form.depth_from_m || !form.depth_to_m || !form.lithology_name"
          @click="submit"
        >เพิ่มชั้น</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
