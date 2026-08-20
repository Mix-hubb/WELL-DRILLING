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
const quoteTarget = ref<RepairRequest | null>(null);
const quoteWorkDetail = ref("");
const quotePrice  = ref<string>("");
const quoteNotes  = ref("");

// Edit / Delete
const editDlg = ref(false);
const editTarget = ref<RepairRequest | null>(null);
const editForm = ref({ problems: [] as string[], detail: "", scheduled_date: "" });
const deleteDlg = ref(false);
const deleteTarget = ref<RepairRequest | null>(null);
const fabOpen = ref(false);
const selectDlg = ref(false);
const selectMode = ref<"edit" | "delete">("edit");

onMounted(async () => {
  try { await requests.fetchAll(); } catch (e) { ui.notifyError(e); }
});

const STATUS_PRIORITY: Record<string, number> = {
  NEW: 0, QUOTED: 1, ACCEPTED: 2, SCHEDULED: 3, IN_PROGRESS: 4,
  COMPLETED: 5, CLOSED: 6, REJECTED: 7, CANCELLED: 8,
};

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  const list = q
    ? requests.requests.filter((r) =>
        (r.customer_name || "").toLowerCase().includes(q) ||
        (r.customer_phone || "").includes(q) ||
        (r.well_name || "").toLowerCase().includes(q)
      )
    : requests.requests;
  return [...list].sort((a, b) => (STATUS_PRIORITY[a.status] ?? 9) - (STATUS_PRIORITY[b.status] ?? 9));
});

function openQuote(r: RepairRequest) {
  quoteTarget.value = r;
  quoteWorkDetail.value = "";
  quotePrice.value = "";
  quoteNotes.value = "";
  quoteDlg.value = true;
}

async function submitQuote() {
  if (!quoteTarget.value || !quotePrice.value) return;
  try {
    const workDetail = quoteWorkDetail.value.trim();
    const extraNotes = quoteNotes.value.trim();
    const combinedNotes = [workDetail, extraNotes].filter(Boolean).join("\n");
    await quotationsApi.createRepair(quoteTarget.value.repair_id, {
      price: Number(quotePrice.value),
      notes: combinedNotes || undefined,
    });
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

function openEdit(r: RepairRequest) {
  editTarget.value = r;
  const probs = typeof r.problems === "string" ? JSON.parse(r.problems) : (r.problems || []);
  editForm.value = {
    problems: probs,
    detail: r.detail || "",
    scheduled_date: r.scheduled_date || "",
  };
  editDlg.value = true;
}

function openSelect(mode: "edit" | "delete") {
  selectMode.value = mode;
  selectDlg.value = true;
  fabOpen.value = false;
}

function pickItem(r: RepairRequest) {
  selectDlg.value = false;
  if (selectMode.value === "edit") {
    openEdit(r);
  } else {
    deleteTarget.value = r;
    deleteDlg.value = true;
  }
}

async function submitEdit() {
  if (!editTarget.value) return;
  try {
    await requests.update(editTarget.value.repair_id, editForm.value);
    ui.notify("แก้ไขข้อมูลแล้ว", "success");
    editDlg.value = false;
  } catch (e) { ui.notifyError(e); }
}

async function doDelete() {
  if (!deleteTarget.value) return;
  try {
    await requests.remove(deleteTarget.value.repair_id);
    ui.notify("ลบคำร้องแล้ว", "success");
    deleteDlg.value = false;
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

          <div v-if="r.detail" class="text-caption text-medium-emphasis mb-2">{{ r.detail }}</div>
          <div v-if="r.scheduled_date" class="text-caption text-medium-emphasis mb-2">นัดซ่อม {{ fmtDate(r.scheduled_date) }}</div>

          <template v-if="r.status !== 'NEW' && r.status !== 'REJECTED' && r.status !== 'CANCELLED'">
            <DrillerLinkChip
              v-if="r.status !== 'QUOTED' && r.status !== 'COMPLETED' && r.status !== 'CLOSED'"
              :token="r.magic_link_token || null" path="/d/repair/"
              class="mb-2"
              @regenerate="regenerateMagicLink(r)"
            />
          </template>

          <v-divider class="my-2" />

          <div v-if="r.status === 'NEW'" class="d-flex ga-2">
            <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-file-document-edit-outline" @click="openQuote(r)">
              ส่งใบราคา
            </v-btn>
          </div>
          <div v-else-if="r.status === 'QUOTED'" class="d-flex ga-2">
            <v-btn size="small" color="teal-darken-2" variant="flat" prepend-icon="mdi-check" @click="setStatus(r.repair_id, 'ACCEPTED')">
              ยอมรับ → ตกลง
            </v-btn>
          </div>
          <div v-else-if="r.status === 'ACCEPTED' || r.status === 'SCHEDULED'" class="d-flex ga-2">
            <v-btn size="small" color="deep-orange-darken-1" variant="flat" prepend-icon="mdi-play" @click="setStatus(r.repair_id, 'IN_PROGRESS')">
              เริ่มซ่อม
            </v-btn>
          </div>
          <div v-else-if="r.status === 'IN_PROGRESS'" class="d-flex ga-2">
            <v-btn size="small" color="teal-darken-2" variant="flat" prepend-icon="mdi-check-all" @click="setStatus(r.repair_id, 'COMPLETED')">
              ซ่อมเสร็จ
            </v-btn>
          </div>
          <div v-else-if="r.status === 'COMPLETED'" class="text-caption text-medium-emphasis">
            <div v-if="r.quotation">ใบราคา {{ money(r.quotation.price) }} บาท</div>
            <div v-if="r.records?.[0]?.final_price" class="mt-1 font-weight-bold text-success">
              จบงาน {{ money(r.records[0].final_price) }} บาท
            </div>
          </div>
          <div v-else class="text-caption text-medium-emphasis">
            {{ REPAIR_STATUS[r.status]?.label || r.status }}
          </div>
        </v-card>
      </v-col>

      <v-col v-if="!filtered.length && !requests.loading" cols="12">
        <div class="text-center py-10 text-medium-emphasis">ยังไม่มีรายการแจ้งซ่อม</div>
      </v-col>
    </v-row>

    <!-- Quotation Dialog -->
    <v-dialog v-model="quoteDlg" max-width="520" persistent>
      <v-card>
        <v-card-title class="pa-4 pb-2 font-display font-weight-bold">
          ส่งใบเสนอราคา
        </v-card-title>
        <v-card-subtitle v-if="quoteTarget" class="px-4 pb-2">
          คำร้องของ: {{ quoteTarget.customer_name }} · {{ quoteTarget.well_name || "" }}
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="pa-4">
          <v-text-field
            v-model="quoteWorkDetail"
            label="รายการอุปกรณ์ที่คาดว่าต้องซ่อมหรือเปลี่ยนใหม่"
            placeholder="เช่น ปั๊ม ผุลูกคุมไฟ เบรกเกอร์ เป็นต้น"
            prepend-inner-icon="mdi-wrench-outline"
            class="mb-3"
            density="comfortable"
            variant="outlined"
          />
          <v-text-field
            v-model="quotePrice"
            type="number"
            label="ราคาประเมิน (บาท) *"
            placeholder="เช่น 55,000"
            prepend-inner-icon="mdi-currency-thb"
            class="mb-3"
            density="comfortable"
            variant="outlined"
          />
          <v-textarea
            v-model="quoteNotes"
            label="หมายเหตุเพิ่มเติม (ถ้ามี)"
            prepend-inner-icon="mdi-information-outline"
            rows="3"
            auto-grow
            density="comfortable"
            variant="outlined"
          />
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4 ga-2">
          <v-spacer />
          <v-btn variant="outlined" @click="quoteDlg = false">ยกเลิก</v-btn>
          <v-btn color="primary" variant="flat" prepend-icon="mdi-file-document-edit-outline" :disabled="!quotePrice" @click="submitQuote">
            ส่งใบราคา
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- FAB Management Menu -->
    <div class="fab-wrapper">
      <v-menu v-model="fabOpen" location="top" :close-on-content-click="true">
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-cog-outline" color="secondary" v-bind="props" elevation="4" />
        </template>
        <v-list density="compact" class="py-1">
          <v-list-item prepend-icon="mdi-pencil-outline" @click="openSelect('edit')">
            <v-list-item-title>แก้ไขคำร้อง</v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-delete-outline" class="text-error" @click="openSelect('delete')">
            <v-list-item-title>ลบคำร้อง</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

    <!-- Select Item Dialog -->
    <v-dialog v-model="selectDlg" max-width="480">
      <v-card>
        <v-card-title class="pa-4 pb-2 font-display font-weight-bold">
          {{ selectMode === 'edit' ? 'เลือกรายการที่ต้องการแก้ไข' : 'เลือกรายการที่ต้องการลบ' }}
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-0" style="max-height:400px;overflow-y:auto">
          <v-list-item
            v-for="r in filtered" :key="r.repair_id"
            @click="pickItem(r)"
            class="py-3"
          >
            <template v-slot:prepend>
              <StatusChip :status="r.status" class="mr-2" />
            </template>
            <v-list-item-title class="font-weight-bold">{{ r.customer_name || `ลูกค้า #${r.customer_id}` }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption">{{ r.customer_phone }} · {{ r.well_name || "" }}</v-list-item-subtitle>
          </v-list-item>
          <div v-if="!filtered.length" class="text-center py-6 text-medium-emphasis text-body-2">ยังไม่มีคำร้อง</div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn variant="outlined" @click="selectDlg = false">ปิด</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Dialog -->
    <v-dialog v-model="editDlg" max-width="520" persistent>
      <v-card>
        <v-card-title class="pa-4 pb-2 font-display font-weight-bold">แก้ไขคำร้องแจ้งซ่อม</v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <div class="text-body-2 font-weight-bold mb-2">อาการที่พบ</div>
          <v-text-field v-model="editForm.detail" label="รายละเอียด" class="mb-3" density="comfortable" variant="outlined" />
          <v-text-field v-model="editForm.scheduled_date" type="date" label="วันนัดหมาย" density="comfortable" variant="outlined" />
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4 ga-2">
          <v-spacer />
          <v-btn variant="outlined" @click="editDlg = false">ยกเลิก</v-btn>
          <v-btn color="primary" variant="flat" @click="submitEdit">บันทึก</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Delete Confirm Dialog -->
    <v-dialog v-model="deleteDlg" max-width="400">
      <v-card>
        <v-card-title class="font-display font-weight-bold">ยืนยันการลบ</v-card-title>
        <v-card-text>ต้องการลบคำร้องของ <strong>{{ deleteTarget?.customer_name || `ลูกค้า #${deleteTarget?.customer_id}` }}</strong> ใช่หรือไม่?</v-card-text>
        <v-card-actions class="pa-4 ga-2">
          <v-spacer />
          <v-btn variant="outlined" @click="deleteDlg = false">ยกเลิก</v-btn>
          <v-btn color="error" variant="flat" @click="doDelete">ลบ</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
.fab-wrapper {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
}
</style>
