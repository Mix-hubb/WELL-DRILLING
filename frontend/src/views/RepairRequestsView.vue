<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useRepairRequestsStore } from "@/stores/repairRequests";
import { useUiStore } from "@/stores/ui";
import { quotationsApi } from "@/api/quotations";
import { repairRequestsApi } from "@/api/repairRequests";
import { api } from "@/api/client";
import type { RepairRequest } from "@/types";
import { money, REPAIR_STATUS } from "@/constants";
import StatusChip from "@/components/StatusChip.vue";
import DrillerLinkChip from "@/components/DrillerLinkChip.vue";

const router   = useRouter();
const requests = useRepairRequestsStore();
const ui       = useUiStore();

const search   = ref("");
const quoteDlg = ref(false);
const quoteTarget = ref<number | null>(null);
const quotePrice  = ref<string>("");

onMounted(async () => {
  try { await requests.fetchAll(); } catch (e) { ui.notifyError(e); }
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return requests.requests;
  return requests.requests.filter((r) =>
    (r.customer_name || "").toLowerCase().includes(q) ||
    (r.customer_phone || "").includes(q) ||
    (r.well_name || "").toLowerCase().includes(q)
  );
});

function openQuote(id: number) { quoteTarget.value = id; quotePrice.value = ""; quoteDlg.value = true; }

async function submitQuote() {
  if (!quoteTarget.value || !quotePrice.value) return;
  try {
    await quotationsApi.createRepair(quoteTarget.value, { price: Number(quotePrice.value) });
    ui.notify("สร้างใบราคาซ่อมแล้ว", "success");
    quoteDlg.value = false;
    await requests.fetchAll();
  } catch (e) { ui.notifyError(e); }
}

async function setStatus(id: number, status: any) {
  try {
    await requests.setStatus(id, status);
    ui.notify("อัปเดตสถานะแล้ว", "success");
  } catch (e) { ui.notifyError(e); }
}

async function regenerateMagicLink(r: RepairRequest) {
  try {
    const { token } = await repairRequestsApi.generateMagicLink(r.repair_id);
    r.magic_link_token = token;
    ui.notify("สร้างลิงก์ช่างใหม่แล้ว", "success");
  } catch (e) { ui.notifyError(e); }
}

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { month: "short", day: "numeric" });
}

function fileUrl(p: string) { return api.fileUrl(p); }
</script>

<template>
  <div>
    <div class="d-flex flex-wrap ga-3 align-center mb-4">
      <div>
        <div class="text-h6 font-display font-weight-bold">รายการแจ้งซ่อม</div>
        <div class="text-caption text-medium-emphasis">แจ้งใหม่: {{ requests.newCount }} · กำลังซ่อม: {{ requests.inProgressCount }}</div>
      </div>
      <v-spacer />
      <v-text-field
        v-model="search" density="compact" variant="outlined" hide-details
        prepend-inner-icon="mdi-magnify"
        placeholder="ค้นหาลูกค้า, เบอร์, บ่อ..."
        style="max-width:280px" clearable
      />
    </div>

    <div v-if="requests.loading" class="text-center py-10 text-medium-emphasis">กำลังโหลด...</div>

    <v-row v-else>
      <v-col v-for="r in filtered" :key="r.repair_id" cols="12" md="6" lg="4">
        <v-card variant="outlined" class="pa-4 h-100">
          <div class="d-flex justify-space-between align-start mb-2">
            <StatusChip :status="r.status" />
            <div class="d-flex align-center ga-1">
              <span class="text-caption text-medium-emphasis">{{ fmtDate(r.created_at || "") }}</span>
              <v-btn
                size="x-small" variant="text" icon="mdi-open-in-new"
                @click.stop="router.push(`/repair-requests/${r.repair_id}`)"
              />
            </div>
          </div>

          <div class="font-weight-bold text-body-1 mb-1">{{ r.well_name || `บ่อบาดาล #${r.well_id ?? "-"}` }}</div>
          <div class="text-caption text-medium-emphasis d-flex align-center ga-1 mb-1">
            <v-icon icon="mdi-account-outline" size="14" /> {{ r.customer_name || `ลูกค้า #${r.customer_id}` }}
          </div>
          <div class="text-caption text-medium-emphasis mb-2 d-flex align-center ga-1">
            <v-icon icon="mdi-phone-outline" size="14" /> {{ r.customer_phone || "-" }}
          </div>

          <div class="d-flex flex-wrap ga-1 mb-2">
            <v-chip v-for="p in r.problems" :key="p" size="x-small" variant="tonal" color="primary">{{ p }}</v-chip>
          </div>
          <div v-if="r.photos?.length" class="d-flex flex-wrap ga-1 mb-2">
            <v-img v-for="p in r.photos" :key="p" :src="fileUrl(p)" width="56" height="56" cover rounded="6" />
          </div>
          <div v-if="r.detail" class="text-caption text-medium-emphasis mb-2">{{ r.detail }}</div>
          <div v-if="r.scheduled_date" class="text-caption text-medium-emphasis mb-2">นัดซ่อม {{ fmtDate(r.scheduled_date) }}</div>

          <v-divider class="my-2" />

          <div class="mb-2">
            <DrillerLinkChip :token="r.magic_link_token || null" path="/d/repair/" @regenerate="regenerateMagicLink(r)" />
          </div>

          <div v-if="r.status === 'NEW'" class="d-flex ga-2">
            <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-file-document-edit-outline" @click="openQuote(r.repair_id)">
              ส่งใบราคา
            </v-btn>
          </div>
          <div v-else-if="r.status === 'QUOTED'" class="d-flex ga-2">
            <v-btn size="small" color="teal-darken-2" variant="flat" prepend-icon="mdi-calendar-check" @click="setStatus(r.repair_id, 'ACCEPTED')">
              ยอมรับ → นัดซ่อม
            </v-btn>
          </div>
          <div v-else-if="r.status === 'ACCEPTED'" class="d-flex ga-2">
            <v-btn size="small" color="blue-darken-2" variant="flat" prepend-icon="mdi-calendar-plus" @click="setStatus(r.repair_id, 'SCHEDULED')">
              นัดซ่อมแล้ว
            </v-btn>
          </div>
          <div v-else-if="r.status === 'SCHEDULED'" class="d-flex ga-2">
            <v-btn size="small" color="deep-orange-darken-1" variant="flat" prepend-icon="mdi-play" @click="setStatus(r.repair_id, 'IN_PROGRESS')">
              เริ่มซ่อม
            </v-btn>
          </div>
          <div v-else-if="r.status === 'IN_PROGRESS'" class="d-flex ga-2">
            <v-btn size="small" color="teal-darken-2" variant="flat" prepend-icon="mdi-check" @click="setStatus(r.repair_id, 'COMPLETED')">
              ซ่อมเสร็จ
            </v-btn>
          </div>
          <div v-else class="text-caption text-medium-emphasis">
            {{ r.quotation ? `ใบราคา ${money(r.quotation.price)} บาท` : REPAIR_STATUS[r.status].label }}
            <div v-if="r.records?.[0]?.final_price" class="mt-1 font-weight-bold text-success">
              จบงาน {{ money(r.records[0].final_price) }} บาท
            </div>
            <div v-if="r.records?.[0]?.payment_slip_url" class="mt-1">
              <v-img :src="fileUrl(r.records[0].payment_slip_url)" width="56" height="56" cover rounded="6" />
            </div>
          </div>
        </v-card>
      </v-col>

      <v-col v-if="!filtered.length && !requests.loading" cols="12">
        <div class="text-center py-10 text-medium-emphasis">ยังไม่มีรายการแจ้งซ่อม</div>
      </v-col>
    </v-row>

    <!-- Quotation Dialog -->
    <v-dialog v-model="quoteDlg" max-width="420">
      <v-card class="pa-2">
        <v-card-title class="font-display font-weight-bold">ส่งใบราคาซ่อม</v-card-title>
        <v-card-text>
          <v-text-field v-model="quotePrice" type="number" label="ราคา (บาท) *" prepend-inner-icon="mdi-currency-thb" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="quoteDlg = false">ยกเลิก</v-btn>
          <v-btn color="primary" variant="flat" :disabled="!quotePrice" @click="submitQuote">ส่งใบราคา</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
