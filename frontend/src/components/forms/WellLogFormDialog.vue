<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ modelValue: boolean }>();
const emit  = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const empty = () => ({
  total_depth:         "",
  casing_depth:        "",
  water_quantity:      "",
  yield_lpm:           "",
  static_water_level:  "",
  pumping_water_level: "",
  completion_date:     new Date().toISOString().slice(0, 10),
  drilling_method:     "ROTARY",
  driller_name:        "",
  notes:               "",
});
const form         = ref(empty());
const showAdvanced = ref(false);

watch(() => props.modelValue, (v) => { if (v) { form.value = empty(); showAdvanced.value = false; } });

function submit() {
  if (!form.value.total_depth || !form.value.completion_date) return;
  emit("submit", {
    total_depth:         Number(form.value.total_depth),
    casing_depth:        form.value.casing_depth ? Number(form.value.casing_depth) : null,
    water_quantity:      Number(form.value.water_quantity) || 0,
    yield_lpm:           form.value.yield_lpm ? Number(form.value.yield_lpm) : null,
    static_water_level:  Number(form.value.static_water_level)  || 0,
    pumping_water_level: Number(form.value.pumping_water_level) || 0,
    completion_date:     form.value.completion_date,
    drilling_method:     form.value.drilling_method || null,
    driller_name:        form.value.driller_name   || null,
    notes:               form.value.notes          || null,
  });
}

const drillingMethods = [
  { title: "Rotary Drilling",      value: "ROTARY"      },
  { title: "Down-the-Hole (DTH)",  value: "DTH"         },
  { title: "Cable Tool",           value: "CABLE_TOOL"  },
  { title: "Direct Mud Rotary",    value: "MUD_ROTARY"  },
  { title: "Air Rotary",           value: "AIR_ROTARY"  },
];
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="520">
    <v-card>
      <v-card-title class="pa-4 font-display font-weight-bold">บันทึกประวัติบ่อบาดาล</v-card-title>
      <v-divider />
      <v-card-text class="pa-4">
        <!-- Required -->
        <v-row dense class="mb-1">
          <v-col cols="6">
            <v-text-field v-model="form.total_depth" type="number" label="ความลึกรวม (ม.) *" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.casing_depth" type="number" label="ความลึกปลอก (ม.)" />
          </v-col>
        </v-row>
        <v-row dense class="mb-1">
          <v-col cols="6">
            <v-text-field v-model="form.water_quantity" type="number" label="ปริมาณน้ำ (ม³/ชม.)" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.yield_lpm" type="number" label="อัตราไหล (L/min)" />
          </v-col>
        </v-row>
        <v-row dense class="mb-1">
          <v-col cols="6">
            <v-text-field v-model="form.static_water_level" type="number" label="ระดับน้ำนิ่ง (ม.)" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.pumping_water_level" type="number" label="ระดับน้ำลด (ม.)" />
          </v-col>
        </v-row>
        <v-text-field v-model="form.completion_date" type="date" label="วันที่เจาะเสร็จ *" class="mb-3" />

        <!-- Advanced -->
        <v-btn
          variant="text" size="small" color="primary"
          :append-icon="showAdvanced ? 'mdi-chevron-up' : 'mdi-chevron-down'"
          @click="showAdvanced = !showAdvanced"
          class="mb-2"
        >ข้อมูลเพิ่มเติม</v-btn>

        <div v-if="showAdvanced">
          <v-select v-model="form.drilling_method" :items="drillingMethods" label="วิธีการเจาะ" class="mb-2" />
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
          :disabled="!form.total_depth || !form.completion_date"
          @click="submit"
        >บันทึก</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
