<script setup lang="ts">
import { ref, watch } from "vue";
import { DRILLING_METHOD, WATER_TYPE } from "@/constants";

const props = defineProps<{ modelValue: boolean }>();
const emit  = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const empty = () => ({
  well_name:          "",
  total_depth_m:      "",
  water_quantity_m3hr: "",
  yield_lpm:          "",
  static_water_level_m:  "",
  pumping_water_level_m: "",
  completion_date:    new Date().toISOString().slice(0, 10),
  drilling_method:    "ROTARY",
  formation_water_type: "FRESH",
  driller_name:       "",
  notes:              "",
});
const form         = ref(empty());
const showAdvanced = ref(false);

const methodOptions  = Object.entries(DRILLING_METHOD).map(([value, title]) => ({ value, title }));
const waterOptions   = Object.entries(WATER_TYPE).map(([value, title]) => ({ value, title }));

watch(() => props.modelValue, (v) => { if (v) { form.value = empty(); showAdvanced.value = false; } });

function submit() {
  if (!form.value.well_name || !form.value.total_depth_m || !form.value.completion_date) return;
  emit("submit", {
    well_name:            form.value.well_name,
    total_depth_m:        Number(form.value.total_depth_m),
    water_quantity_m3hr:  Number(form.value.water_quantity_m3hr) || null,
    yield_lpm:            form.value.yield_lpm ? Number(form.value.yield_lpm) : null,
    static_water_level_m: Number(form.value.static_water_level_m)  || null,
    pumping_water_level_m: Number(form.value.pumping_water_level_m) || null,
    completion_date:      form.value.completion_date,
    drilling_method:      form.value.drilling_method || null,
    formation_water_type: form.value.formation_water_type || null,
    driller_name:         form.value.driller_name   || null,
    notes:                form.value.notes          || null,
  });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="520">
    <v-card>
      <v-card-title class="pa-4 font-display font-weight-bold">บันทึกประวัติบ่อบาดาล</v-card-title>
      <v-divider />
      <v-card-text class="pa-4">
        <!-- Required -->
        <v-text-field v-model="form.well_name" label="ชื่อบ่อ *" class="mb-3" />
        <v-row dense class="mb-1">
          <v-col cols="6">
            <v-text-field v-model="form.total_depth_m" type="number" label="ความลึกรวม (ม.) *" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.water_quantity_m3hr" type="number" label="ปริมาณน้ำ (ม³/ชม.)" />
          </v-col>
        </v-row>
        <v-row dense class="mb-1">
          <v-col cols="6">
            <v-text-field v-model="form.yield_lpm" type="number" label="อัตราไหล (L/min)" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.static_water_level_m" type="number" label="ระดับน้ำนิ่ง (ม.)" />
          </v-col>
        </v-row>
        <v-row dense class="mb-1">
          <v-col cols="6">
            <v-text-field v-model="form.pumping_water_level_m" type="number" label="ระดับน้ำลด (ม.)" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.completion_date" type="date" label="วันที่เจาะเสร็จ *" />
          </v-col>
        </v-row>

        <!-- Advanced -->
        <v-btn
          variant="text" size="small" color="primary"
          :append-icon="showAdvanced ? 'mdi-chevron-up' : 'mdi-chevron-down'"
          @click="showAdvanced = !showAdvanced"
          class="mb-2"
        >ข้อมูลเพิ่มเติม</v-btn>

        <div v-if="showAdvanced">
          <v-select v-model="form.drilling_method" :items="methodOptions" label="วิธีการเจาะ" class="mb-2" />
          <v-select v-model="form.formation_water_type" :items="waterOptions" label="ประเภทน้ำบาดาล" class="mb-2" />
          <v-text-field v-model="form.driller_name" label="ช่างผู้รับผิดชอบ" class="mb-2" />
          <v-textarea v-model="form.notes" label="บันทึกช่าง" rows="2" />
        </div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 ga-2">
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn
          color="primary" variant="flat"
          :disabled="!form.well_name || !form.total_depth_m || !form.completion_date"
          @click="submit"
        >บันทึก</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
