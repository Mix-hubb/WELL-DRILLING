<script setup lang="ts">
import { useRoute } from "vue-router";
import { useDrillerRepairForm } from "@/composables/useDrillerRepairForm";
import PumpCatalogPicker from "@/components/PumpCatalogPicker.vue";

const route = useRoute();
const token    = route.params.token as string;
const { request, loading, submitting, saved, form, addPart, removePart, submit } = useDrillerRepairForm(token);
</script>

<template>
  <div style="max-width:560px;margin:0 auto">
    <div v-if="loading" class="text-center py-10 text-medium-emphasis">กำลังโหลด...</div>

    <!-- บันทึกสำเร็จ -->
    <div v-else-if="saved" class="text-center py-16">
      <v-icon icon="mdi-check-circle" size="80" color="success" class="mb-4" />
      <div class="text-h5 font-weight-bold" style="color: #2E2418;">บันทึกสำเร็จ</div>
    </div>

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
