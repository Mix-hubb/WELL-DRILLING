<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useDrillingRequestsStore } from "@/stores/drillingRequests";
import { useJobsStore } from "@/stores/jobs";
import { useUiStore } from "@/stores/ui";
import { quotationsApi } from "@/api/quotations";
import { money, REQUEST_STATUS } from "@/constants";
import type { DrillingRequest } from "@/types";
import StatusChip from "@/components/StatusChip.vue";

const router     = useRouter();
const requests   = useDrillingRequestsStore();
const jobsStore  = useJobsStore();
const ui         = useUiStore();

const search   = ref("");
const quoteDlg = ref(false);
const quoteTarget = ref<DrillingRequest | null>(null);
const quoteDepth  = ref<string>("");
const quoteDiameter = ref<string>("");
const quotePrice  = ref<string>("");
const quoteNotes  = ref("");
const linkMenu = ref(false);
const copied = ref(false);

// Edit / Delete
const editDlg = ref(false);
const editTarget = ref<DrillingRequest | null>(null);
const editForm = ref({ name: "", phone: "", address: "", requested_depth_m: null as number | null, appointment_date: "", notes: "" });
const deleteDlg = ref(false);
const deleteTarget = ref<DrillingRequest | null>(null);
const fabOpen = ref(false);
const selectDlg = ref(false);
const selectMode = ref<"edit" | "delete">("edit");

const formLink = computed(() => {
  const base = import.meta.env.VITE_APP_URL || window.location.origin;
  return `${base}/request-drill`;
});

async function copyLink() {
  try {
    await navigator.clipboard.writeText(formLink.value);
    copied.value = true;
    ui.notify("คัดลอกลิงค์แล้ว", "success");
    setTimeout(() => { copied.value = false; }, 2000);
  } catch {
    ui.notify("ไม่สามารถคัดลอกได้", "error");
  }
}

function openEdit(r: DrillingRequest) {
  editTarget.value = r;
  editForm.value = {
    name: r.name,
    phone: r.phone,
    address: r.address || "",
    requested_depth_m: r.requested_depth_m ?? null,
    appointment_date: r.appointment_date || "",
    notes: r.notes || "",
  };
  editDlg.value = true;
  fabOpen.value = false;
}

function openSelect(mode: "edit" | "delete") {
  selectMode.value = mode;
  selectDlg.value = true;
  fabOpen.value = false;
}

function pickItem(r: DrillingRequest) {
  selectDlg.value = false;
  if (selectMode.value === "edit") {
    openEdit(r);
  } else {
    confirmDelete(r);
  }
}

async function submitEdit() {
  if (!editTarget.value) return;
  try {
    await requests.update(editTarget.value.request_id, editForm.value);
    ui.notify("แก้ไขข้อมูลแล้ว", "success");
    editDlg.value = false;
  } catch (e) { ui.notifyError(e); }
}

function confirmDelete(r: DrillingRequest) {
  deleteTarget.value = r;
  deleteDlg.value = true;
  fabOpen.value = false;
}

async function doDelete() {
  if (!deleteTarget.value) return;
  try {
    await requests.remove(deleteTarget.value.request_id);
    ui.notify("ลบคำร้องแล้ว", "success");
    deleteDlg.value = false;
  } catch (e) { ui.notifyError(e); }
}

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

function openQuote(r: DrillingRequest) {
  quoteTarget.value = r;
  quoteDepth.value = r.requested_depth_m ? String(r.requested_depth_m) : "";
  quoteDiameter.value = "";
  quotePrice.value = "";
  quoteNotes.value = "";
  quoteDlg.value = true;
}

async function submitQuote() {
  if (!quoteTarget.value || !quotePrice.value) return;
  try {
    await quotationsApi.createDrilling(quoteTarget.value.request_id, {
      price: Number(quotePrice.value),
      requested_depth_m: quoteDepth.value ? Number(quoteDepth.value) : null,
      requested_diameter_m: quoteDiameter.value ? Number(quoteDiameter.value) : null,
      notes: quoteNotes.value || undefined,
    });
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
            <div class="d-flex ga-2 align-center">
              <StatusChip :status="r.status" />
              <v-chip v-if="r.source === 'LINE'" size="x-small" color="teal-lighten-3" variant="flat" class="font-weight-bold">
                แจ้งไลน์
              </v-chip>
            </div>
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
          <div v-if="r.appointment_date" class="text-caption text-medium-emphasis mb-2 d-flex align-center ga-1">
            <v-icon icon="mdi-calendar-outline" size="14" /> วันนัดหมาย {{ fmtDate(r.appointment_date) }}
          </div>
          <div v-if="r.notes" class="text-caption text-medium-emphasis mb-2">{{ r.notes }}</div>

          <template v-if="r.status === 'QUOTED' && r.quotation">
            <v-divider class="my-2" />
            <div class="text-caption text-medium-emphasis">
              ใบราคา {{ money(r.quotation.price) }} บาท
            </div>
          </template>

          <v-divider class="my-2" />

          <div v-if="r.status === 'NEW'" class="d-flex ga-2">
            <v-btn size="small" color="primary" variant="flat" prepend-icon="mdi-file-document-edit-outline" @click="openQuote(r)">
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
            {{ REQUEST_STATUS[r.status]?.label || r.status }}
          </div>
        </v-card>
      </v-col>

      <v-col v-if="!filtered.length && !requests.loading" cols="12">
        <div class="text-center py-10 text-medium-emphasis">ยังไม่มีคำร้องแจ้งเจาะ</div>
      </v-col>
    </v-row>

    <!-- Quotation Dialog -->
    <v-dialog v-model="quoteDlg" max-width="520" persistent>
      <v-card>
        <v-card-title class="pa-4 pb-2 font-display font-weight-bold">
          ส่งใบเสนอราคา
        </v-card-title>
        <v-card-subtitle v-if="quoteTarget" class="px-4 pb-2">
          คำร้องของ: {{ quoteTarget.name }} · {{ quoteTarget.address }}
        </v-card-subtitle>
        <v-divider />
        <v-card-text class="pa-4">
          <v-text-field
            v-model="quoteDepth"
            type="number"
            label="ความลึกที่คาดว่าจะทำการขุดเจาะ (ม.)"
            prepend-inner-icon="mdi-ruler"
            class="mb-3"
            density="comfortable"
            variant="outlined"
          />
          <v-text-field
            v-model="quoteDiameter"
            type="number"
            label="ความลึกที่คาดว่าจะเจอชั้นน้ำ (ม.)"
            prepend-inner-icon="mdi-water-outline"
            class="mb-3"
            density="comfortable"
            variant="outlined"
          />
          <v-text-field
            v-model="quotePrice"
            type="number"
            label="ราคาประเมิน (บาท) *"
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

    <!-- Floating Link Menu -->
    <div class="link-fab-wrapper">
      <v-menu v-model="linkMenu" :close-on-content-click="false" location="top">
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-link-variant" color="primary" v-bind="props" elevation="4" />
        </template>
        <v-card min-width="340" class="pa-4">
          <div class="text-body-2 font-weight-bold mb-1">ลิงค์แจ้งเจาะสำหรับลูกค้า</div>
          <div class="text-caption text-medium-emphasis mb-3">ส่งลิงค์นี้ให้ลูกค้าเพื่อกรอกคำร้องแจ้งเจาะ</div>
          <div class="d-flex align-center ga-2">
            <v-icon icon="mdi-link-variant" size="16" color="primary" />
            <span class="text-caption text-medium-emphasis text-truncate" style="max-width:200px">{{ formLink }}</span>
            <v-btn size="x-small" variant="tonal" prepend-icon="mdi-content-copy" @click="copyLink">
              {{ copied ? 'คัดลอกแล้ว' : 'copy' }}
            </v-btn>
            <v-btn size="x-small" variant="tonal" prepend-icon="mdi-refresh" @click="copyLink">
              สร้างใหม่
            </v-btn>
          </div>
        </v-card>
      </v-menu>
    </div>

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
            v-for="r in filtered" :key="r.request_id"
            @click="pickItem(r)"
            class="py-3"
          >
            <template v-slot:prepend>
              <StatusChip :status="r.status" class="mr-2" />
            </template>
            <v-list-item-title class="font-weight-bold">{{ r.name }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption">{{ r.phone }} · {{ r.address || 'ไม่ระบุที่อยู่' }}</v-list-item-subtitle>
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
        <v-card-title class="pa-4 pb-2 font-display font-weight-bold">แก้ไขคำร้องแจ้งเจาะ</v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <v-text-field v-model="editForm.name" label="ชื่อ-นามสกุล" class="mb-3" density="comfortable" variant="outlined" />
          <v-text-field v-model="editForm.phone" label="เบอร์โทร" class="mb-3" density="comfortable" variant="outlined" />
          <v-textarea v-model="editForm.address" label="ที่อยู่" rows="2" class="mb-3" density="comfortable" variant="outlined" />
          <v-text-field v-model="editForm.requested_depth_m" type="number" label="ความลึกที่ต้องการ (ม.)" class="mb-3" density="comfortable" variant="outlined" />
          <v-text-field v-model="editForm.appointment_date" type="date" label="วันนัดหมาย" class="mb-3" density="comfortable" variant="outlined" />
          <v-textarea v-model="editForm.notes" label="หมายเหตุ" rows="2" density="comfortable" variant="outlined" />
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
        <v-card-text>ต้องการลบคำร้องของ <strong>{{ deleteTarget?.name }}</strong> ใช่หรือไม่?</v-card-text>
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
.link-fab-wrapper {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
}

.fab-wrapper {
  position: fixed;
  bottom: 80px;
  right: 24px;
  z-index: 100;
}
</style>
