<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; submit: [{ team_name: string; leader_name: string; phone: string }] }>();

const form = ref({ team_name: "", leader_name: "", phone: "" });
const valid = ref(false);

watch(() => props.modelValue, (v) => {
  if (v) form.value = { team_name: "", leader_name: "", phone: "" };
});

function submit() {
  if (!form.value.team_name || !form.value.leader_name || !form.value.phone) return;
  emit("submit", { ...form.value });
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="440">
    <v-card class="pa-2">
      <v-card-title class="font-display font-weight-bold">เพิ่มทีมช่างเจาะ</v-card-title>
      <v-card-text>
        <v-form v-model="valid">
          <v-text-field v-model="form.team_name" label="ชื่อทีม" class="mb-1" />
          <v-text-field v-model="form.leader_name" label="ชื่อหัวหน้าทีม" class="mb-1" />
          <v-text-field v-model="form.phone" label="เบอร์โทร" />
        </v-form>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn color="primary" variant="flat" :disabled="!form.team_name || !form.leader_name || !form.phone" @click="submit">บันทึก</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
