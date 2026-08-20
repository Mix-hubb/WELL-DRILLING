<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { repairRequestsApi } from "@/api/repairRequests";
import { quotationsApi } from "@/api/quotations";
import { api } from "@/api/client";
import { useUiStore } from "@/stores/ui";
import type { RepairRequest } from "@/types";
import { REPAIR_STATUS, QUOTATION_STATUS, money } from "@/constants";
import StatusChip from "@/components/StatusChip.vue";
import DrillerLinkChip from "@/components/DrillerLinkChip.vue";

const route = useRoute();
const router = useRouter();
const ui = useUiStore();

const request = ref<RepairRequest | null>(null);
const loading = ref(true);

const quoteDlg = ref(false);
const quotePrice = ref("");
const quoteNotes = ref("");

const canQuote = computed(() => request.value && !request.value.quotation && request.value.status === "NEW");

onMounted(async () => {
  try {
    request.value = await repairRequestsApi.getOne(route.params.id as string);
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
});

async function reload() {
  request.value = await repairRequestsApi.getOne(route.params.id as string);
}

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

async function setStatus(status: RepairRequest["status"]) {
  if (!request.value) return;
  try {
    await repairRequestsApi.updateStatus(request.value.repair_id, status);
    await reload();
    ui.notify("อัปเดตสถานะแล้ว", "success");
  } catch (e) {
    ui.notifyError(e);
  }
}

async function createQuote() {
  if (!request.value || !quotePrice.value) return;
  try {
    await quotationsApi.createRepair(request.value.repair_id, {
      price: Number(quotePrice.value),
      notes: quoteNotes.value || undefined,
    });
    quoteDlg.value = false;
    await reload();
    ui.notify("สร้างใบราคาซ่อมแล้ว", "success");
  } catch (e) {
    ui.notifyError(e);
  }
}

async function regenerateMagicLink() {
  if (!request.value) return;
  try {
    const { token } = await repairRequestsApi.generateMagicLink(request.value.repair_id);
    request.value.magic_link_token = token;
    ui.notify("สร้างลิงก์ช่างใหม่แล้ว", "success");
  } catch (e) {
    ui.notifyError(e);
  }
}
</script>

<template>
  <div>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" size="small" class="mb-2" @click="router.push('/repair-requests')">
      กลับไปรายการแจ้งซ่อม
    </v-btn>

    <div v-if="loading" class="text-center py-10 text-medium-emphasis">กำลังโหลด...</div>

    <template v-else-if="request">
      <!-- Header -->
      <v-card class="pa-4 mb-4">
        <div class="d-flex flex-wrap align-center ga-3 mb-2">
          <div class="text-h6 font-display font-weight-bold">{{ request.well_name || `บ่อบาดาล #${request.well_id ?? "-"}` }}</div>
          <StatusChip :status="request.status" />
          <v-spacer />
          <span class="text-caption text-medium-emphasis">แจ้งเมื่อ {{ fmtDate(request.created_at) }}</span>
        </div>
        <div class="text-caption text-medium-emphasis d-flex align-center ga-1 mb-1">
          <v-icon icon="mdi-account-outline" size="14" />
          {{ request.customer_name || `ลูกค้า #${request.customer_id}` }}
          <template v-if="request.customer_phone"> · {{ request.customer_phone }}</template>
        </div>
        <div v-if="request.scheduled_date" class="text-caption text-medium-emphasis mb-1">
          <v-icon icon="mdi-calendar-check-outline" size="14" /> นัดซ่อม {{ fmtDate(request.scheduled_date) }}
        </div>
        <div class="pt-1">
          <DrillerLinkChip :token="request.magic_link_token || null" path="/d/repair/" @regenerate="regenerateMagicLink" />
        </div>
      </v-card>

      <!-- Problems + detail + photos -->
      <v-card class="pa-4 mb-4">
        <div class="text-subtitle-1 font-display font-weight-bold mb-2">รายละเอียดการแจ้ง</div>
        <div class="d-flex flex-wrap ga-1 mb-2">
          <v-chip v-for="p in request.problems" :key="p" size="small" variant="tonal" color="primary">{{ p }}</v-chip>
        </div>
        <div v-if="request.detail" class="text-body-2 mb-2">{{ request.detail }}</div>
        <div v-if="request.photos?.length" class="d-flex flex-wrap ga-2 mt-2">
          <a v-for="p in request.photos" :key="p" :href="api.fileUrl(p)" target="_blank">
            <v-img :src="api.fileUrl(p)" width="96" height="96" cover rounded="8" />
          </a>
        </div>
      </v-card>

      <!-- Quotation -->
      <v-card class="pa-4 mb-4">
        <div class="d-flex justify-space-between align-center mb-2">
          <div class="text-subtitle-1 font-display font-weight-bold">ใบเสนอราคา</div>
          <v-btn v-if="canQuote" size="small" color="primary" variant="flat" prepend-icon="mdi-file-document-edit-outline" @click="quoteDlg = true">
            ส่งใบราคา
          </v-btn>
        </div>
        <template v-if="request.quotation">
          <div class="d-flex align-center ga-3">
            <span class="text-h6 font-weight-bold">{{ money(request.quotation.price) }} บาท</span>
            <v-chip size="small" :color="QUOTATION_STATUS[request.quotation.status].color" variant="tonal">
              {{ QUOTATION_STATUS[request.quotation.status].label }}
            </v-chip>
          </div>
          <div v-if="request.quotation.notes" class="text-caption text-medium-emphasis mt-1">{{ request.quotation.notes }}</div>
        </template>
        <div v-else class="text-caption text-medium-emphasis">ยังไม่มีใบราคา</div>
      </v-card>

      <!-- Status actions -->
      <v-card class="pa-4 mb-4">
        <div class="text-subtitle-1 font-display font-weight-bold mb-2">การดำเนินการ</div>
        <div v-if="request.status === 'NEW'" class="text-caption text-medium-emphasis">
          ส่งใบราคาเพื่อให้ลูกค้ายืนยันก่อนดำเนินการ
        </div>
        <div v-else-if="request.status === 'QUOTED'" class="d-flex ga-2">
          <v-btn size="small" color="teal-darken-2" variant="flat" prepend-icon="mdi-calendar-check" @click="setStatus('ACCEPTED')">
            ลูกค้ายอมรับ → ยืนยัน
          </v-btn>
          <v-btn size="small" color="error" variant="tonal" prepend-icon="mdi-close" @click="setStatus('REJECTED')">
            ลูกค้าปฏิเสธ
          </v-btn>
        </div>
        <div v-else-if="request.status === 'ACCEPTED'" class="d-flex ga-2">
          <v-btn size="small" color="blue-darken-2" variant="flat" prepend-icon="mdi-calendar-plus" @click="setStatus('SCHEDULED')">
            ยืนยันวันนัด
          </v-btn>
        </div>
        <div v-else-if="request.status === 'SCHEDULED'" class="d-flex ga-2">
          <v-btn size="small" color="deep-orange-darken-1" variant="flat" prepend-icon="mdi-play" @click="setStatus('IN_PROGRESS')">
            เริ่มซ่อม
          </v-btn>
        </div>
        <div v-else-if="request.status === 'IN_PROGRESS'" class="d-flex ga-2">
          <v-btn size="small" color="teal-darken-2" variant="flat" prepend-icon="mdi-check" @click="setStatus('COMPLETED')">
            ซ่อมเสร็จ (ช่างกรอกแล้ว)
          </v-btn>
        </div>
        <div v-else-if="request.status === 'COMPLETED'" class="d-flex ga-2">
          <v-btn size="small" color="grey-darken-1" variant="flat" prepend-icon="mdi-check-all" @click="setStatus('CLOSED')">
            ปิดงาน
          </v-btn>
        </div>
        <div v-else class="text-caption text-medium-emphasis">{{ REPAIR_STATUS[request.status].label }}</div>
      </v-card>

      <!-- Records -->
      <v-card class="pa-4">
        <div class="text-subtitle-1 font-display font-weight-bold mb-2">บันทึกการซ่อม ({{ request.records?.length ?? 0 }})</div>
        <div v-if="request.records?.length">
          <v-card v-for="rec in request.records" :key="rec.record_id" variant="outlined" class="pa-3 mb-3">
            <div class="d-flex justify-space-between align-center mb-1">
              <div class="text-subtitle-2 font-weight-bold">บันทึก #{{ rec.record_id }}</div>
              <div class="text-caption text-medium-emphasis">{{ fmtDate(rec.completed_at) }}</div>
            </div>
            <div v-if="rec.final_price" class="font-weight-bold text-success mb-1">ราคาจบงาน {{ money(rec.final_price) }} บาท</div>
            <div v-if="rec.is_warranty_claim" class="mb-1">
              <v-chip size="x-small" color="teal-darken-2" variant="tonal">ใช้สิทธิ์ประกัน</v-chip>
            </div>
            <div v-if="rec.work_details" class="text-body-2 mb-2">{{ rec.work_details }}</div>

            <div v-if="rec.pump" class="mb-2 pa-2 rounded" style="background:rgba(0,0,0,0.04)">
              <div class="text-caption font-weight-bold mb-1">ปั๊มที่ติดตั้ง: {{ rec.pump.brand }} {{ rec.pump.model }}</div>
              <div class="text-caption">
                <template v-if="rec.pump.series">ซีรีส์ {{ rec.pump.series }} · </template>
                <template v-if="rec.pump.motor_power">{{ rec.pump.motor_power }}</template>
                <template v-if="rec.pump.phase"> · {{ rec.pump.phase }}</template>
                <template v-if="rec.pump.impeller_stages"> · {{ rec.pump.impeller_stages }}</template>
                <template v-if="rec.pump.max_head_m"> · เฮด {{ rec.pump.max_head_m }}</template>
                <template v-if="rec.pump.reference_price"> · ราคาอ้างอิง {{ money(rec.pump.reference_price) }} บาท</template>
              </div>
            </div>

            <v-table v-if="rec.parts?.length" density="compact" class="mb-2">
              <thead>
                <tr><th>อะไหล่/รายการ</th><th class="text-right">จำนวน</th><th class="text-right">ราคา/ชิ้น</th><th class="text-right">รวม</th></tr>
              </thead>
              <tbody>
                <tr v-for="p in rec.parts" :key="p.name">
                  <td>{{ p.name }}</td>
                  <td class="text-right">{{ p.qty }}</td>
                  <td class="text-right">{{ money(p.unit_price) }}</td>
                  <td class="text-right">{{ money(p.qty * p.unit_price) }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </div>
        <div v-else class="text-caption text-medium-emphasis">ยังไม่มีบันทึกการซ่อม (ช่างกรอกผ่านลิงก์)</div>
      </v-card>

      <!-- Quote dialog -->
      <v-dialog v-model="quoteDlg" max-width="420">
        <v-card class="pa-4">
          <v-card-title class="px-0 pt-0 text-h6 font-display font-weight-bold">ส่งใบราคาซ่อม</v-card-title>
          <v-card-text class="px-0">
            <v-text-field v-model="quotePrice" type="number" label="ราคา (บาท) *" class="mb-3" />
            <v-textarea v-model="quoteNotes" label="รายละเอียดงาน / อุปกรณ์ที่ต้องเปลี่ยน" rows="3" />
          </v-card-text>
          <v-card-actions class="px-0 pb-0">
            <v-spacer />
            <v-btn variant="text" @click="quoteDlg = false">ยกเลิก</v-btn>
            <v-btn color="primary" variant="flat" :disabled="!quotePrice" @click="createQuote">ส่งใบราคา</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </template>

    <v-card v-else class="pa-6 text-center">
      <v-icon icon="mdi-wrench-off-outline" size="40" class="mb-2" />
      <div class="text-h6 font-display font-weight-bold">ไม่พบรายการแจ้งซ่อม</div>
    </v-card>
  </div>
</template>
