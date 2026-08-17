<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDrillingRequestsStore } from "@/stores/drillingRequests";
import { useJobsStore } from "@/stores/jobs";
import { useUiStore } from "@/stores/ui";
import { quotationsApi } from "@/api/quotations";
import { money, REQUEST_STATUS } from "@/constants";
import StatusChip from "@/components/StatusChip.vue";

const router     = useRouter();
const requests   = useDrillingRequestsStore();
const jobsStore  = useJobsStore();
const ui         = useUiStore();

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
    r.name.toLowerCase().includes(q) || r.phone.includes(q) ||
    (r.address || "").toLowerCase().includes(q)
  );
});

function openQuote(id: number) { quoteTarget.value = id; quotePrice.value = ""; quoteDlg.value = true; }

async function submitQuote() {
  if (!quoteTarget.value || !quotePrice.value) return;
  try {
    await quotationsApi.createDrilling(quoteTarget.value, { price: Number(quotePrice.value) });
    ui.notify("สร้างใบราคาแล้ว", "success");
    quoteDlg.value = false;
    await requests.fetchAll();
  } catch (e) { ui.notifyError(e); }
}

async function acceptAndQueue(r: any) {
  try {
    await requests.setStatus(r.request_id, "ACCEPTED");
    await jobsStore.create({
      request_id:   r.request_id,
      customer_id:  r.customer_id,
      job_title:    `เจาะบ่อ ${r.name}`,
      site_address: r.address,
      notes:        r.notes,
    });
    ui.notify("ยอมรับคำร้องและเข้าระบบคิวแล้ว", "success");
    router.push("/jobs");
  } catch (e) { ui.notifyError(e); }
}

async function reject(r: any) {
  try {
    await requests.setStatus(r.request_id, "REJECTED");
    ui.notify("ปฏิเสธคำร้องแล้ว", "info");
  } catch (e) { ui.notifyError(e); }
}

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { month: "short", day: "numeric" });
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap ga-3 align-center mb-4">
      <div>
        <div class="text-h6 font-display font-weight-bold">คำร้องแจ้งเจาะ</div>
        <div class="text-caption text-medium-emphasis">คำร้องใหม่: {{ requests.newCount }} · รอใบราคา: {{ requests.quotedCount }}</div>
      </div>
      <v-spacer />
      <v-text-field
        v-model="search" density="compact" variant="outlined" hide-details
        prepend-inner-icon="mdi-magnify"
        placeholder="ค้นหาชื่อ, เบอร์, ที่อยู่..."
        style="max-width:280px" clearable
      />
    </div>

    <div v-if="requests.loading" class="text-center py-10 text-medium-emphasis">กำลังโหลด...</div>

    <v-row v-else>
      <v-col v-for="r in filtered" :key="r.request_id" cols="12" md="6" lg="4">
        <v-card variant="outlined" class="pa-4 h-100">
          <div class="d-flex justify-space-between align-start mb-2">
            <StatusChip :status="r.status" />
            <span class="text-caption text-medium-emphasis">{{ fmtDate(r.created_at || "") }}</span>
          </div>

          <div class="font-weight-bold text-body-1 mb-1">{{ r.name }}</div>
          <div class="text-caption text-medium-emphasis d-flex align-center ga-1 mb-1">
            <v-icon icon="mdi-phone-outline" size="14" /> {{ r.phone }}
          </div>
          <div class="text-caption text-medium-emphasis mb-2 d-flex align-center ga-1">
            <v-icon icon="mdi-map-marker-outline" size="14" /> {{ r.address || "ไม่ระบุที่ตั้ง" }}
          </div>
          <div v-if="r.requested_depth_m" class="text-caption text-medium-emphasis mb-2">
            <v-icon icon="mdi-ruler" size="14" /> ความลึกที่ขอ {{ r.requested_depth_m }} ม.
          </div>
          <div v-if="r.notes" class="text-caption text-medium-emphasis mb-2">{{ r.notes }}</div>

          <v-divider class="my-2" />

          <div v-if="r.status === 'NEW'" class="d-flex ga-2">
            <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-file-document-edit-outline" @click="openQuote(r.request_id)">
              ส่งใบราคา
            </v-btn>
            <v-btn size="small" color="error" variant="tonal" prepend-icon="mdi-close" @click="reject(r)">ปฏิเสธ</v-btn>
          </div>
          <div v-else-if="r.status === 'QUOTED'" class="d-flex ga-2">
            <v-btn size="small" color="teal-darken-2" variant="flat" prepend-icon="mdi-check" @click="acceptAndQueue(r)">
              ยอมรับ → ขึ้นคิว
            </v-btn>
          </div>
          <div v-else class="text-caption text-medium-emphasis">
            {{ r.quotation ? `ใบราคา ${money(r.quotation.price)} บาท` : REQUEST_STATUS[r.status].label }}
          </div>
        </v-card>
      </v-col>

      <v-col v-if="!filtered.length && !requests.loading" cols="12">
        <div class="text-center py-10 text-medium-emphasis">ยังไม่มีคำร้องแจ้งเจาะ</div>
      </v-col>
    </v-row>

    <!-- Quotation Dialog -->
    <v-dialog v-model="quoteDlg" max-width="420">
      <v-card class="pa-2">
        <v-card-title class="font-display font-weight-bold">ส่งใบราคาเจาะ</v-card-title>
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
