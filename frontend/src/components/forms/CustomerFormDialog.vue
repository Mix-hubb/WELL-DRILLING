<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; submit: [{ customer_name: string; phone: string; address: string }] }>();

const form = ref({ customer_name: "", phone: "", address: "" });

watch(() => props.modelValue, (v) => {
  if (v) form.value = { customer_name: "", phone: "", address: "" };
});

function submit() {
  if (!form.value.customer_name || !form.value.phone) return;
  emit("submit", { ...form.value });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="440">
    <v-card class="pa-2">
      <v-card-title class="font-display font-weight-bold">เพิ่มลูกค้า</v-card-title>
      <v-card-text>
        <v-text-field v-model="form.customer_name" label="ชื่อลูกค้า" class="mb-1" />
        <v-text-field v-model="form.phone" label="เบอร์โทร" class="mb-1" />
        <v-textarea v-model="form.address" label="ที่อยู่" rows="2" />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!form.customer_name || !form.phone" @click="submit">บันทึก</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
