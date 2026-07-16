<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { wellsApi } from "@/api/wells";

const props = defineProps<{ modelValue: boolean }>();
const emit  = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

interface LithologyType {
  type_id: number;
  type_name: string;
  type_name_th: string;
  color_hex: string;
}
const lithologyTypes = ref<LithologyType[]>([]);

onMounted(async () => {
  try {
    lithologyTypes.value = await wellsApi.getLithologyTypes();
  } catch {}
});

const empty = () => ({
  depth_from: "" as string | number,
  depth_to:   "" as string | number,
  lithology_type_id: null as number | null,
  is_water_bearing: false,
  hardness: "",
  conductivity_us: "",
  ph_value: "",
  tds_ppm: "",
  description: "",
});
const form = ref(empty());
const showAdvanced = ref(false);

watch(() => props.modelValue, (v) => { if (v) { form.value = empty(); showAdvanced.value = false; } });

function submit() {
  if (!form.value.depth_from || !form.value.depth_to || !form.value.lithology_type_id) return;
  emit("submit", {
    depth_from:        Number(form.value.depth_from),
    depth_to:          Number(form.value.depth_to),
    lithology_type_id: form.value.lithology_type_id,
    is_water_bearing:  form.value.is_water_bearing ? 1 : 0,
    hardness:          form.value.hardness || null,
    conductivity_us:   form.value.conductivity_us ? Number(form.value.conductivity_us) : null,
    ph_value:          form.value.ph_value         ? Number(form.value.ph_value)         : null,
    tds_ppm:           form.value.tds_ppm          ? Number(form.value.tds_ppm)          : null,
    description:       form.value.description      || null,
  });
}

const hardnessOpts = [
  { title: "อ่อนมาก",  value: "VERY_SOFT" },
  { title: "อ่อน",     value: "SOFT"      },
  { title: "ปานกลาง", value: "MEDIUM"    },
  { title: "แข็ง",    value: "HARD"      },
  { title: "แข็งมาก", value: "VERY_HARD" },
];
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="480">
    <v-card>
      <v-card-title class="pa-4 font-display font-weight-bold">เพิ่มช่วงชั้นดิน / หิน</v-card-title>
      <v-divider />
      <v-card-text class="pa-4">
        <v-row dense class="mb-1">
          <v-col cols="6">
            <v-text-field v-model="form.depth_from" type="number" label="ความลึกเริ่ม (ม.) *" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.depth_to" type="number" label="ความลึกสิ้นสุด (ม.) *" />
          </v-col>
        </v-row>

        <v-select
          v-model="form.lithology_type_id"
          :items="lithologyTypes"
          item-title="type_name_th"
          item-value="type_id"
          label="ประเภทชั้นดิน/หิน *"
          class="mb-2"
        >
          <template #item="{ item, props: p }">
            <v-list-item v-bind="p">
              <template #prepend>
                <div :style="{ width:'14px', height:'14px', borderRadius:'3px', background: item.raw.color_hex, border:'1px solid rgba(0,0,0,0.2)', marginRight:'8px' }" />
              </template>
            </v-list-item>
          </template>
        </v-select>

        <v-checkbox v-model="form.is_water_bearing" label="💧 ชั้นน้ำบาดาล" color="primary" hide-details class="mb-2" />

        <!-- Advanced toggle -->
        <v-btn
          variant="text" size="small" color="primary"
          :append-icon="showAdvanced ? 'mdi-chevron-up' : 'mdi-chevron-down'"
          @click="showAdvanced = !showAdvanced"
          class="mb-2"
        >ข้อมูลอุทกธรณีวิทยา</v-btn>

        <div v-if="showAdvanced">
          <v-select v-model="form.hardness" :items="hardnessOpts" label="ความแข็ง" clearable class="mb-2" />
          <v-row dense>
            <v-col cols="4"><v-text-field v-model="form.ph_value" type="number" label="pH" /></v-col>
            <v-col cols="4"><v-text-field v-model="form.conductivity_us" type="number" label="EC (μS/cm)" /></v-col>
            <v-col cols="4"><v-text-field v-model="form.tds_ppm" type="number" label="TDS (mg/L)" /></v-col>
          </v-row>
        </div>

        <v-text-field v-model="form.description" label="หมายเหตุช่าง" class="mt-1" />
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 ga-2">
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn
          color="primary" variant="flat"
          :disabled="!form.depth_from || !form.depth_to || !form.lithology_type_id"
          @click="submit"
        >เพิ่มชั้น</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
