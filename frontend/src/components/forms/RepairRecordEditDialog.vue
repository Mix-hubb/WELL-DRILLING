<script setup lang="ts">
import { ref, watch } from "vue";
import type { RepairRecord, RepairPart } from "@/types";

const props = defineProps<{
  modelValue: boolean;
  record?: RepairRecord | null;
  mode?: "create" | "edit";
}>();

const emit = defineEmits<{
  "update:modelValue": [boolean];
  submit: [Partial<RepairRecord>];
}>();

const isCreate = () => props.mode === "create" || (!props.record && props.mode !== "edit");

const form = ref({
  work_details: "",
  final_price: null as number | null,
  is_warranty_claim: false,
  parts: [] as RepairPart[],
  pump_brand: "",
  pump_model: "",
  pump_power: "",
  pump_price: null as number | null,
});

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      if (props.record) {
        form.value = {
          work_details: props.record.work_details || "",
          final_price: props.record.final_price ? Number(props.record.final_price) : null,
          is_warranty_claim: Boolean(props.record.is_warranty_claim),
          parts: Array.isArray(props.record.parts)
            ? JSON.parse(JSON.stringify(props.record.parts))
            : [],
          pump_brand: props.record.pump?.brand || "",
          pump_model: props.record.pump?.model || "",
          pump_power: props.record.pump?.motor_power || "",
          pump_price: props.record.pump?.reference_price ? Number(props.record.pump.reference_price) : null,
        };
      } else {
        form.value = {
          work_details: "",
          final_price: null,
          is_warranty_claim: false,
          parts: [],
          pump_brand: "",
          pump_model: "",
          pump_power: "",
          pump_price: null,
        };
      }
    }
  }
);

function addPart() {
  form.value.parts.push({ name: "", qty: 1, unit_price: 0 });
}

function removePart(index: number) {
  form.value.parts.splice(index, 1);
}

function submit() {
  const pumpData =
    form.value.pump_brand.trim() || form.value.pump_model.trim()
      ? {
          brand: form.value.pump_brand.trim(),
          model: form.value.pump_model.trim(),
          motor_power: form.value.pump_power.trim() || undefined,
          reference_price: form.value.pump_price != null ? Number(form.value.pump_price) : undefined,
        }
      : null;

  emit("submit", {
    work_details: form.value.work_details.trim() || undefined,
    final_price: form.value.final_price != null ? Number(form.value.final_price) : null,
    is_warranty_claim: form.value.is_warranty_claim ? 1 : 0,
    parts: form.value.parts.filter((p: RepairPart) => p.name.trim()),
    pump: pumpData as any,
  });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="600">
    <v-card>
      <v-card-title class="pa-4 font-display font-weight-bold">
        {{ isCreate() ? 'บันทึกการซ่อมใหม่' : `แก้ไขบันทึกการซ่อม #${record?.record_id}` }}
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-4">
        <v-row dense>
          <v-col cols="12" sm="7">
            <v-text-field
              v-model="form.final_price"
              type="number"
              label="ราคาจบงาน (บาท)"
              placeholder="เช่น 3500"
            />
          </v-col>
          <v-col cols="12" sm="5" class="d-flex align-center">
            <v-checkbox
              v-model="form.is_warranty_claim"
              label="ใช้สิทธิ์ประกัน (ฟรี)"
              color="primary"
              hide-details
            />
          </v-col>
          <v-col cols="12">
            <v-textarea
              v-model="form.work_details"
              label="รายละเอียดงานซ่อม"
              rows="3"
              placeholder="เช่น ตรวจเช็กระบบไฟ เปลี่ยนคาปาซิเตอร์ และซีลกันน้ำ..."
            />
          </v-col>
        </v-row>

        <!-- Pump info section -->
        <div class="text-subtitle-2 font-weight-bold mt-2 mb-2">ปั๊มน้ำที่เปลี่ยน (ถ้ามี)</div>
        <v-row dense class="mb-2">
          <v-col cols="6">
            <v-text-field v-model="form.pump_brand" label="ยี่ห้อปั๊ม" density="compact" placeholder="เช่น FRANKLIN" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.pump_model" label="รุ่นปั๊ม" density="compact" placeholder="เช่น 10FPS05" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.pump_power" label="กำลังมอเตอร์" density="compact" placeholder="เช่น 1.5 HP" />
          </v-col>
          <v-col cols="6">
            <v-text-field v-model="form.pump_price" type="number" label="ราคาปั๊ม (บาท)" density="compact" />
          </v-col>
        </v-row>

        <!-- Parts list section -->
        <div class="d-flex align-center justify-space-between mt-3 mb-2">
          <div class="text-subtitle-2 font-weight-bold">รายการอะไหล่ / อุปกรณ์</div>
          <v-btn size="x-small" variant="tonal" color="primary" prepend-icon="mdi-plus" @click="addPart">
            เพิ่มอะไหล่
          </v-btn>
        </div>

        <div v-if="form.parts.length">
          <v-row v-for="(part, idx) in form.parts" :key="idx" dense class="align-center mb-1">
            <v-col cols="6">
              <v-text-field v-model="part.name" label="ชื่ออะไหล่" density="compact" hide-details />
            </v-col>
            <v-col cols="2">
              <v-text-field v-model.number="part.qty" type="number" label="จำนวน" density="compact" hide-details />
            </v-col>
            <v-col cols="3">
              <v-text-field v-model.number="part.unit_price" type="number" label="ราคา/ชิ้น" density="compact" hide-details />
            </v-col>
            <v-col cols="1" class="text-center">
              <v-btn icon="mdi-close" size="x-small" variant="text" color="error" @click="removePart(idx)" />
            </v-col>
          </v-row>
        </div>
        <div v-else class="text-caption text-medium-emphasis">ไม่มีรายการอะไหล่แยก</div>
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 ga-2">
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn color="primary" variant="flat" @click="submit">
          {{ isCreate() ? 'บันทึก' : 'บันทึกการแก้ไข' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
