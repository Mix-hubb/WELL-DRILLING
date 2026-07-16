<script setup lang="ts">
import { ref, watch } from "vue";
import { PIPE_TYPE, PIPE_SIZE, THICKNESS } from "@/constants";
import type { PipeType, PipeSize, ThicknessClass } from "@/types";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; submit: [Record<string, any>] }>();

const typeOptions = Object.entries(PIPE_TYPE).map(([value, title]) => ({ value, title }));
const sizeOptions = Object.entries(PIPE_SIZE).map(([value, title]) => ({ value, title }));
const thicknessOptions = Object.entries(THICKNESS).map(([value, title]) => ({ value, title }));

const empty = () => ({
  depth_from: "", depth_to: "",
  pipe_type: "CASING_PVC" as PipeType, pipe_size: "6_INCH" as PipeSize, thickness_class: "CLASS_13.5" as ThicknessClass,
});
const form = ref(empty());

watch(() => props.modelValue, (v) => { if (v) form.value = empty(); });

function submit() {
  if (form.value.depth_from === "" || form.value.depth_to === "") return;
  emit("submit", {
    depth_from: Number(form.value.depth_from),
    depth_to: Number(form.value.depth_to),
    pipe_type: form.value.pipe_type,
    pipe_size: form.value.pipe_size,
    thickness_class: form.value.thickness_class,
  });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="440">
    <v-card class="pa-2">
      <v-card-title class="font-display font-weight-bold">เพิ่มข้อมูลท่อ</v-card-title>
      <v-card-text>
        <v-row dense>
          <v-col cols="6"><v-text-field v-model="form.depth_from" type="number" label="ความลึกเริ่ม (ม.)" /></v-col>
          <v-col cols="6"><v-text-field v-model="form.depth_to" type="number" label="ความลึกสิ้นสุด (ม.)" /></v-col>
        </v-row>
        <v-select v-model="form.pipe_type" :items="typeOptions" label="ประเภทท่อ" class="mb-1" />
        <v-row dense>
          <v-col cols="6"><v-select v-model="form.pipe_size" :items="sizeOptions" label="ขนาดท่อ" /></v-col>
          <v-col cols="6"><v-select v-model="form.thickness_class" :items="thicknessOptions" label="ชั้นความหนา" /></v-col>
        </v-row>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn color="primary" variant="flat" :disabled="form.depth_from === '' || form.depth_to === ''" @click="submit">เพิ่มท่อ</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
