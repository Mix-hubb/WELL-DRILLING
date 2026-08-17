<script setup lang="ts">
import { ref, watch } from "vue";
import { PIPE_MATERIAL, PIPE_TYPE, PIPE_SIZE_OPTIONS } from "@/constants";
import type { PipeMaterial, PipeType } from "@/types";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const materialOptions = Object.entries(PIPE_MATERIAL).map(([value, title]) => ({ value, title }));
const typeOptions = Object.entries(PIPE_TYPE).map(([value, title]) => ({ value, title }));

const empty = () => ({
  depth_from_m: "", depth_to_m: "",
  material: "PVC" as PipeMaterial, pipe_type: "CASING" as PipeType,
  size_mm: "", quantity: 1,
});
const form = ref(empty());

watch(() => props.modelValue, (v) => { if (v) form.value = empty(); });

function submit() {
  if (form.value.depth_from_m === "" || form.value.depth_to_m === "") return;
  emit("submit", {
    depth_from_m: Number(form.value.depth_from_m),
    depth_to_m:   Number(form.value.depth_to_m),
    material:     form.value.material,
    pipe_type:    form.value.pipe_type,
    size_mm:      form.value.size_mm !== "" ? Number(form.value.size_mm) : null,
    quantity:     Number(form.value.quantity) || 1,
  });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="440">
    <v-card class="pa-2">
      <v-card-title class="font-display font-weight-bold">เพิ่มข้อมูลท่อ</v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.depth_from_m" type="number" label="ความลึกเริ่ม (ม.)" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.depth_to_m" type="number" label="ความลึกสิ้นสุด (ม.)" /></v-col>
        </v-row>
        <v-row dense>
          <v-col cols="6"><v-select v-model="form.material" :items="materialOptions" label="วัสดุ" /></v-col>
          <v-col cols="6"><v-select v-model="form.pipe_type" :items="typeOptions" label="ประเภทท่อ" /></v-col>
        </v-row>
        <v-row dense>
          <v-col cols="6">
            <v-combobox
              v-model="form.size_mm"
              :items="PIPE_SIZE_OPTIONS"
              item-title="title"
              item-value="value"
              label="ขนาดท่อ"
              placeholder="เลือกหรือพิมพ์ เช่น 160"
              clearable
            />
          </v-col>
          <v-col cols="6"><v-text-field v-model="form.quantity" type="number" label="จำนวน" /></v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn color="primary" variant="flat" :disabled="form.depth_from_m === '' || form.depth_to_m === ''" @click="submit">เพิ่มท่อ</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
