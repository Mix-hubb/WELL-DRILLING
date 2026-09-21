<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { jobsApi } from "@/api/jobs";
import { useUiStore } from "@/stores/ui";
import { fmtDate } from "@/utils/date";
import type { DrillingJob } from "@/types";
import StatusChip from "@/components/StatusChip.vue";
import WellLogFormDialog from "@/components/forms/WellLogFormDialog.vue";

const route = useRoute();
const token = route.params.token as string;
const ui = useUiStore();
const job = ref<DrillingJob | null>(null);
const loading = ref(true);
const showWellForm = ref(false);
const wellId = ref<number | null>(null);

onMounted(async () => {
  try {
    job.value = await jobsApi.getByMagicToken(token);
    wellId.value = job.value?.well_id ?? null;
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
});

async function submitWellLog(form: any) {
  if (!job.value) return;
  try {
    await jobsApi.completeWell(job.value.job_id, form);
    showWellForm.value = false;
    job.value = await jobsApi.getByMagicToken(token);
    wellId.value = job.value?.well_id ?? null;
    ui.notify("บันทึกข้อมูลเรียบร้อยแล้ว", "success");
  } catch (e) {
    ui.notifyError(e);
  }
}
</script>

<template>
  <div style="max-width:560px;margin:0 auto;padding:16px">
    <div v-if="loading" class="text-center py-10 text-medium-emphasis">กำลังโหลด...</div>

    <v-card v-else-if="job" class="pa-5">
      <div class="text-center mb-4">
        <v-icon icon="mdi-water-check-outline" color="primary" size="40" class="mb-2" />
        <div class="text-h6 font-display font-weight-bold">ข้อมูลงานเจาะบ่อบาดาล</div>
        <div class="text-caption text-medium-emphasis">
          คิวงาน: {{ job.job_title || `#${job.job_id}` }}
        </div>
      </div>

      <!-- สถานะงาน -->
      <div class="mb-4 pa-3 rounded-lg" style="background: #FDFBF7; border: 1px solid #E2D9CC;">
        <div class="text-subtitle-2 font-weight-bold mb-2" style="color: #2E2418;">
          <v-icon icon="mdi-information-outline" size="18" class="mr-1" />
          สถานะงาน
        </div>
        <StatusChip :status="job.status" />
        <div v-if="job.result" class="mt-2">
          <v-chip size="small" :color="job.result === 'SUCCESS' ? 'success' : 'error'" variant="tonal">
            {{ job.result === 'SUCCESS' ? 'เจาะสำเร็จ' : 'เจาะไม่สำเร็จ' }}
          </v-chip>
        </div>
      </div>

      <!-- ข้อมูลลูกค้า -->
      <div class="mb-4 pa-3 rounded-lg" style="background: #FDFBF7; border: 1px solid #E2D9CC;">
        <div class="text-subtitle-2 font-weight-bold mb-2" style="color: #2E2418;">
          <v-icon icon="mdi-account-outline" size="18" class="mr-1" />
          ข้อมูลลูกค้า
        </div>
        <div class="text-body-2 mb-1"><strong>ชื่อ:</strong> {{ job.customer_name }}</div>
        <div v-if="job.customer_phone" class="text-body-2 mb-1">
          <strong>เบอร์โทร:</strong>
          <a :href="`tel:${job.customer_phone}`" class="text-primary">{{ job.customer_phone }}</a>
        </div>
        <div v-if="job.site_address || job.province" class="text-body-2">
          <strong>ที่อยู่:</strong> {{ job.site_address || job.province || "-" }}
        </div>
      </div>

      <!-- ข้อมูลบ่อ (ถ้ามี well_id) -->
      <template v-if="job.well_id">
        <v-divider class="my-3" />
        <div class="text-subtitle-2 font-weight-bold mb-2" style="color: #2E2418;">
          <v-icon icon="mdi-water-well" size="18" class="mr-1" />
          ข้อมูลบ่อบาดาล
        </div>
        <div v-if="job.well_name" class="text-body-2 mb-1"><strong>ชื่อบ่อ:</strong> {{ job.well_name }}</div>
        <div v-if="job.warranty_expire_date" class="text-body-2 mb-1">
          <strong>ประกันหมดอายุ:</strong> {{ fmtDate(job.warranty_expire_date) }}
        </div>
      </template>

      <!-- วันนัดหมาย -->
      <div v-if="job.scheduled_date" class="mt-3 pa-3 rounded-lg" style="background: #FDFBF7; border: 1px solid #E2D9CC;">
        <div class="text-subtitle-2 font-weight-bold mb-1" style="color: #2E2418;">
          <v-icon icon="mdi-calendar-outline" size="18" class="mr-1" />
          วันนัดหมาย
        </div>
        <div class="text-body-2">{{ fmtDate(job.scheduled_date) }}</div>
      </div>

      <!-- บันทึก -->
      <div v-if="job.notes" class="mt-3 pa-3 rounded-lg" style="background: #FDFBF7; border: 1px solid #E2D9CC;">
        <div class="text-subtitle-2 font-weight-bold mb-1" style="color: #2E2418;">
          <v-icon icon="mdi-note-text-outline" size="18" class="mr-1" />
          บันทึก
        </div>
        <div class="text-body-2">{{ job.notes }}</div>
      </div>

      <!-- ปุ่มบันทึกประวัติบ่อบาดาล (แสดงเมื่องานเจาะเสร็จหรือไม่สำเร็จ) -->
      <v-btn
        v-if="job.status === 'SUCCESS' || job.status === 'FAILED' || job.status === 'CLOSED'"
        color="primary" variant="flat" block prepend-icon="mdi-lead-pencil"
        class="mt-4"
        @click="showWellForm = true"
      >
        {{ wellId ? 'แก้ไขข้อมูลบ่อบาดาล' : 'บันทึกข้อมูลบ่อบาดาล' }}
      </v-btn>
    </v-card>

    <v-card v-else class="pa-6 text-center">
      <v-icon icon="mdi-link-off" size="40" class="mb-2" />
      <div class="text-h6 font-display font-weight-bold">ลิงก์ไม่ถูกต้องหรือหมดอายุ</div>
      <div class="text-caption text-medium-emphasis mt-1">กรุณาติดต่อเจ้าของระบบ</div>
    </v-card>

    <WellLogFormDialog
      v-model="showWellForm"
      :job-status="job?.status"
      @submit="submitWellLog"
    />
  </div>
</template>
