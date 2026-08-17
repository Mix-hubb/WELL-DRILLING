<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { repairRequestsApi } from "@/api/repairRequests";
import { api } from "@/api/client";
import { useUiStore } from "@/stores/ui";
import type { RepairRequest, PumpCatalogModel } from "@/types";
import PumpCatalogPicker from "@/components/PumpCatalogPicker.vue";

const route = useRoute();
const ui    = useUiStore();

const request  = ref<RepairRequest | null>(null);
const loading  = ref(true);
const submitting = ref(false);
const uploading  = ref(false);
const token    = route.params.token as string;

const form = ref({
  work_details:   "",
  parts:          [{ name: "", qty: 1, unit_price: 0 }],
  final_price:    "",
  is_warranty_claim: false,
  completed_at:   new Date().toISOString().slice(0, 10),
  payment_slip_url: "" as string,
  pump:           null as PumpCatalogModel | null,
});

onMounted(async () => {
  try {
    request.value = await repairRequestsApi.getByMagicToken(token);
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
});

function addPart() { form.value.parts.push({ name: "", qty: 1, unit_price: 0 }); }
function removePart(i: number) { form.value.parts.splice(i, 1); }

async function onSlip(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;
  uploading.value = true;
  try {
    form.value.payment_slip_url = await api.upload(input.files[0], "magic", token);
  } catch (err) {
    ui.notifyError(err);
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

function removeSlip() { form.value.payment_slip_url = ""; }

async function submit() {
  if (!request.value || !form.value.work_details) return;
  submitting.value = true;
  try {
    await repairRequestsApi.addRecord(request.value.repair_id, {
      magic_token:       token,
      work_details:   form.value.work_details,
      parts:          form.value.parts.filter((p) => p.name).map((p) => ({ name: p.name, qty: Number(p.qty) || 0, unit_price: Number(p.unit_price) || 0 })),
      pump:           form.value.pump,
      final_price:    form.value.final_price ? Number(form.value.final_price) : null,
      payment_slip_url: form.value.payment_slip_url || null,
      is_warranty_claim: form.value.is_warranty_claim ? 1 : 0,
      completed_at:   form.value.completed_at,
    });
    ui.notify("บันทึกข้อมูลการซ่อมแล้ว", "success");
  } catch (e) {
    ui.notifyError(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div style="max-width:560px;margin:0 auto">
    <div v-if="loading" class="text-center py-10 text-medium-emphasis">กำลังโหลด...</div>

    <v-card v-else-if="request" class="pa-5">
      <div class="text-center mb-4">
        <v-icon icon="mdi-wrench-check-outline" color="primary" size="40" class="mb-2" />
        <div class="text-h6 font-display font-weight-bold">บันทึกการซ่อม</div>
        <div class="text-caption text-medium-emphasis">
          บ่อ: {{ request.well_name || "-" }} · ลูกค้า: {{ request.customer_name }}
        </div>
      </div>

      <div class="mb-3">
        <div class="text-subtitle-2 font-weight-bold mb-1">อาการที่แจ้ง</div>
        <v-chip v-for="p in request.problems" :key="p" size="small" variant="tonal" color="primary" class="mr-1">{{ p }}</v-chip>
      </div>
      <div v-if="request.detail" class="text-caption text-medium-emphasis mb-3">{{ request.detail }}</div>

      <v-textarea v-model="form.work_details" label="รายละเอียดงานที่ซ่อม *" rows="3" class="mb-3" />

      <div class="text-subtitle-2 font-weight-bold mb-1">ปั๊มที่เปลี่ยน/ติดตั้ง (ถ้ามี)</div>
      <PumpCatalogPicker v-model="form.pump" label="รุ่นปั๊ม" class="mb-3" />

      <div class="d-flex align-center justify-space-between mb-2">
        <div class="text-subtitle-2 font-weight-bold">อะไหล่ / ค่าใช้จ่าย</div>
        <v-btn size="x-small" variant="tonal" prepend-icon="mdi-plus" @click="addPart">เพิ่ม</v-btn>
      </div>
      <v-row v-for="(p, i) in form.parts" :key="i" dense align="center" class="mb-1">
        <v-col cols="5"><v-text-field v-model="p.name" label="ชื่ออะไหล่" density="compact" hide-details /></v-col>
        <v-col cols="3"><v-text-field v-model="p.qty" type="number" label="จำนวน" density="compact" hide-details /></v-col>
        <v-col cols="3"><v-text-field v-model="p.unit_price" type="number" label="ราคา/ชิ้น" density="compact" hide-details /></v-col>
        <v-col cols="1">
          <v-btn v-if="form.parts.length > 1" icon="mdi-close" size="x-small" variant="text" @click="removePart(i)" />
        </v-col>
      </v-row>

      <v-row dense class="mt-3">
        <v-col cols="6"><v-text-field v-model="form.final_price" type="number" label="ค่าแรง/ราคารวม (บาท)" /></v-col>
        <v-col cols="6"><v-text-field v-model="form.completed_at" type="date" label="วันที่ซ่อมเสร็จ" /></v-col>
      </v-row>
      <v-checkbox v-model="form.is_warranty_claim" label="เป็นการซ่อมภายใต้ประกัน" color="primary" hide-details class="mb-3" />

      <div class="text-subtitle-2 font-weight-bold mb-1">สลิปการชำระเงิน</div>
      <div class="d-flex align-center ga-3 mb-4">
        <template v-if="form.payment_slip_url">
          <v-img :src="api.fileUrl(form.payment_slip_url)" width="72" height="72" cover rounded="6" />
          <v-btn size="small" variant="text" color="error" prepend-icon="mdi-close" @click="removeSlip">ลบ</v-btn>
        </template>
        <label
          class="d-flex align-center justify-center"
          style="width:72px;height:72px;border:1px dashed rgba(0,0,0,0.3);border-radius:6px;cursor:pointer"
        >
          <v-icon v-if="!uploading" icon="mdi-camera-plus-outline" color="medium-emphasis" />
          <v-progress-circular v-else size="20" indeterminate color="primary" />
          <input type="file" accept="image/*" hidden @change="onSlip" />
        </label>
      </div>

      <v-btn
        color="primary" size="large" block variant="flat" :loading="submitting"
        :disabled="!form.work_details"
        @click="submit"
      >บันทึกการซ่อม</v-btn>
    </v-card>

    <v-card v-else class="pa-6 text-center">
      <v-icon icon="mdi-link-off" size="40" class="mb-2" />
      <div class="text-h6 font-display font-weight-bold">ลิงก์ไม่ถูกต้องหรือหมดอายุ</div>
      <div class="text-caption text-medium-emphasis mt-1">กรุณาติดต่อเจ้าของระบบ</div>
    </v-card>
  </div>
</template>
