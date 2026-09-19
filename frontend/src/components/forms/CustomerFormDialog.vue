<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { Customer } from "@/types";
import { allowOnlyDigits, cleanPhoneNumber, validThaiPhone, requiredField } from "@/utils/validation";

const props = defineProps<{
  modelValue: boolean;
  customer?: Customer | null;
}>();

const emit = defineEmits<{
  "update:modelValue": [boolean];
  submit: [Partial<Customer>];
}>();

const isEdit = computed(() => !!props.customer?.customer_id);

const form = ref({
  customer_name: "",
  phone: "",
  phone_alt: "",
  address: "",
  notes: "",
});

watch(
  () => props.modelValue,
  (val) => {
    if (val) {
      if (props.customer) {
        form.value = {
          customer_name: props.customer.customer_name || "",
          phone: props.customer.phone || "",
          phone_alt: props.customer.phone_alt || "",
          address: props.customer.address || "",
          notes: (props.customer as any).notes || "",
        };
      } else {
        form.value = {
          customer_name: "",
          phone: "",
          phone_alt: "",
          address: "",
          notes: "",
        };
      }
    }
  }
);

const isFormValid = computed(() => {
  if (!form.value.customer_name.trim()) return false;
  if (validThaiPhone()(form.value.phone) !== true) return false;
  if (form.value.phone_alt && validThaiPhone()(form.value.phone_alt) !== true) return false;
  return true;
});

function submit() {
  if (!isFormValid.value) return;
  emit("submit", {
    customer_name: form.value.customer_name.trim(),
    phone: form.value.phone.trim(),
    phone_alt: form.value.phone_alt.trim() || undefined,
    address: form.value.address.trim() || undefined,
    notes: form.value.notes.trim() || undefined,
  } as any);
}
</script>

<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="540">
    <v-card>
      <v-card-title class="pa-4 font-display font-weight-bold">
        {{ isEdit ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มลูกค้าใหม่" }}
      </v-card-title>
      <v-divider />
      <v-card-text class="pa-4">
        <v-text-field
          v-model="form.customer_name"
          label="ชื่อ-นามสกุล ลูกค้า *"
          placeholder="เช่น คุณสมชาย ใจดี"
          :rules="[requiredField('กรุณากรอกชื่อลูกค้า')]"
          class="mb-3"
        />
        <v-row dense class="mb-1">
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.phone"
              label="เบอร์โทรศัพท์ *"
              type="tel"
              maxlength="10"
              placeholder="0812345678"
              @keypress="allowOnlyDigits"
              @input="(e: any) => form.phone = cleanPhoneNumber(e.target?.value ?? form.phone)"
              :rules="[requiredField('กรุณากรอกเบอร์โทรศัพท์'), validThaiPhone()]"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="form.phone_alt"
              label="เบอร์โทรศัพท์สำรอง"
              type="tel"
              maxlength="10"
              placeholder="0898765432"
              @keypress="allowOnlyDigits"
              @input="(e: any) => form.phone_alt = cleanPhoneNumber(e.target?.value ?? form.phone_alt)"
              :rules="[validThaiPhone()]"
            />
          </v-col>
        </v-row>
        <v-textarea
          v-model="form.address"
          label="ที่อยู่ / พิกัดหน้างาน"
          rows="2"
          class="mb-3"
        />
        <v-textarea
          v-model="form.notes"
          label="หมายเหตุเพิ่มเติม"
          rows="2"
        />
      </v-card-text>
      <v-divider />
      <v-card-actions class="pa-4 ga-2">
        <v-spacer />
        <v-btn variant="text" @click="$emit('update:modelValue', false)">ยกเลิก</v-btn>
        <v-btn
          color="primary"
          variant="flat"
          :disabled="!isFormValid"
          @click="submit"
        >
          {{ isEdit ? "บันทึกการแก้ไข" : "เพิ่มลูกค้า" }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
