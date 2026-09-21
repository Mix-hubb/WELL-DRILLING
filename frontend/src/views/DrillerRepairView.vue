<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { repairRequestsApi } from "@/api/repairRequests";
import { useUiStore } from "@/stores/ui";
import { fmtDate } from "@/utils/date";
import { REPAIR_STATUS } from "@/constants";
import type { RepairRequest, RepairRecord } from "@/types";
import RepairRecordEditDialog from "@/components/forms/RepairRecordEditDialog.vue";

const route = useRoute();
const token = route.params.token as string;
const ui = useUiStore();
const request = ref<RepairRequest | null>(null);
const loading = ref(true);
const showRecordForm = ref(false);

onMounted(async () => {
  try {
    request.value = await repairRequestsApi.getByMagicToken(token);
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
});

async function submitRecord(data: Partial<RepairRecord>) {
  if (!request.value) return;
  try {
    await repairRequestsApi.addRecord(request.value.repair_id, data);
    showRecordForm.value = false;
    request.value = await repairRequestsApi.getByMagicToken(token);
    ui.notify("บันทึกข้อมูลเรียบร้อยแล้ว", "success");
  } catch (e) {
    ui.notifyError(e);
  }
}
</script>

<template>
  <div style="max-width:560px;margin:0 auto;padding:16px">
    <div v-if="loading" class="text-center py-10 text-medium-emphasis">กำลังโหลด...</div>

    <v-card v-else-if="request" class="pa-5">
      <div class="text-center mb-4">
        <v-icon icon="mdi-wrench-check-outline" color="primary" size="40" class="mb-2" />
        <div class="text-h6 font-display font-weight-bold">ข้อมูลคำร้องซ่อมบำรุง</div>
        <div class="text-caption text-medium-emphasis">
          คำร้อง #{{ request.repair_id }}
        </div>
      </div>

      <!-- สถานะ -->
      <div class="mb-4 pa-3 rounded-lg" style="background: #FDFBF7; border: 1px solid #E2D9CC;">
        <div class="text-subtitle-2 font-weight-bold mb-2" style="color: #2E2418;">
          <v-icon icon="mdi-information-outline" size="18" class="mr-1" />
          สถานะคำร้อง
        </div>
        <v-chip size="small" :color="REPAIR_STATUS[request.status]?.color || 'grey'" variant="tonal">
          {{ REPAIR_STATUS[request.status]?.label || request.status }}
        </v-chip>
      </div>

      <!-- ข้อมูลลูกค้า -->
      <div class="mb-4 pa-3 rounded-lg" style="background: #FDFBF7; border: 1px solid #E2D9CC;">
        <div class="text-subtitle-2 font-weight-bold mb-2" style="color: #2E2418;">
          <v-icon icon="mdi-account-outline" size="18" class="mr-1" />
          ข้อมูลลูกค้า
        </div>
        <div class="text-body-2 mb-1"><strong>ชื่อ:</strong> {{ request.customer_name }}</div>
        <div v-if="request.customer_phone" class="text-body-2 mb-1">
          <strong>เบอร์โทร:</strong>
          <a :href="`tel:${request.customer_phone}`" class="text-primary">{{ request.customer_phone }}</a>
        </div>
        <div v-if="request.well_name" class="text-body-2">
          <strong>บ่อที่ต้องการซ่อม:</strong> {{ request.well_name }}
        </div>
      </div>

      <!-- อาการที่พบ -->
      <div class="mb-4 pa-3 rounded-lg" style="background: #FDFBF7; border: 1px solid #E2D9CC;">
        <div class="text-subtitle-2 font-weight-bold mb-2" style="color: #2E2418;">
          <v-icon icon="mdi-alert-circle-outline" size="18" class="mr-1" />
          อาการที่พบ
        </div>
        <div class="d-flex flex-wrap ga-1 mb-2">
          <v-chip v-for="p in request.problems" :key="p" size="small" variant="tonal" color="primary">
            {{ p }}
          </v-chip>
        </div>
        <div v-if="request.detail" class="text-body-2 text-medium-emphasis">{{ request.detail }}</div>
      </div>

      <!-- วันที่สะดวกรับบริการ -->
      <div v-if="request.scheduled_date" class="mb-4 pa-3 rounded-lg" style="background: #FDFBF7; border: 1px solid #E2D9CC;">
        <div class="text-subtitle-2 font-weight-bold mb-1" style="color: #2E2418;">
          <v-icon icon="mdi-calendar-outline" size="18" class="mr-1" />
          วันที่สะดวกรับบริการ
        </div>
        <div class="text-body-2">{{ fmtDate(request.scheduled_date) }}</div>
      </div>

      <!-- บันทึกการซ่อม (ถ้ามี) -->
      <template v-if="request.records && request.records.length">
        <v-divider class="my-3" />
        <div class="text-subtitle-2 font-weight-bold mb-2" style="color: #2E2418;">
          <v-icon icon="mdi-clipboard-check-outline" size="18" class="mr-1" />
          บันทึกการซ่อม
        </div>
        <div v-for="(rec, idx) in request.records" :key="idx" class="mb-3 pa-3 rounded-lg" style="background: #FDFBF7; border: 1px solid #E2D9CC;">
          <div v-if="rec.work_details" class="text-body-2 mb-1"><strong>รายละเอียดงาน:</strong> {{ rec.work_details }}</div>
          <div v-if="rec.completed_at" class="text-caption text-medium-emphasis">วันที่ซ่อมเสร็จ: {{ fmtDate(rec.completed_at) }}</div>
        </div>
      </template>

      <!-- ปุ่มบันทึกการซ่อม -->
      <v-btn
        v-if="request.status === 'IN_PROGRESS' || request.status === 'SCHEDULED' || request.status === 'ACCEPTED'"
        color="primary" variant="flat" block prepend-icon="mdi-plus"
        class="mt-4"
        @click="showRecordForm = true"
      >
        บันทึกการซ่อม
      </v-btn>
    </v-card>

    <v-card v-else class="pa-6 text-center">
      <v-icon icon="mdi-link-off" size="40" class="mb-2" />
      <div class="text-h6 font-display font-weight-bold">ลิงก์ไม่ถูกต้องหรือหมดอายุ</div>
      <div class="text-caption text-medium-emphasis mt-1">กรุณาติดต่อเจ้าของระบบ</div>
    </v-card>

    <RepairRecordEditDialog
      v-model="showRecordForm"
      mode="create"
      @submit="submitRecord"
    />
  </div>
</template>
