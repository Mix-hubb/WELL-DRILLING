<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useJobsStore }      from "@/stores/jobs";
import { useCustomersStore } from "@/stores/customers";
import { useUiStore }        from "@/stores/ui";
import { jobsApi }           from "@/api/jobs";
import type { DrillingJob }  from "@/types";
import { JOB_STATUS }        from "@/constants";
import StatusChip   from "@/components/StatusChip.vue";
import DrillerLinkChip from "@/components/DrillerLinkChip.vue";
import JobFormDialog from "@/components/forms/JobFormDialog.vue";

const router          = useRouter();
const jobsStore       = useJobsStore();
const customersStore  = useCustomersStore();
const ui              = useUiStore();

const tab      = ref("ALL");
const search   = ref("");
const showForm = ref(false);

// Edit / Delete
const editDlg = ref(false);
const editTarget = ref<DrillingJob | null>(null);
const editForm = ref({ job_title: "", site_address: "", province: "", district: "", scheduled_date: "", notes: "" });
const deleteDlg = ref(false);
const deleteTarget = ref<DrillingJob | null>(null);
const fabOpen = ref(false);
const selectDlg = ref(false);
const selectMode = ref<"edit" | "delete">("edit");

onMounted(async () => {
  try {
    await Promise.all([jobsStore.fetchAll(), customersStore.fetchAll()]);
  } catch (e) { ui.notifyError(e); }
});

const statusTabs = ["QUEUED", "DRILLING", "SUCCESS", "FAILED"] as const;

const filtered = computed(() => {
  let list = tab.value === "ALL" ? jobsStore.jobs : jobsStore.byStatus(tab.value as any);
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase();
    list = list.filter((j) =>
      (j.job_title || "").toLowerCase().includes(q) ||
      (j.customer_name || "").toLowerCase().includes(q) ||
      (j.site_address || "").toLowerCase().includes(q) ||
      (j.province || "").toLowerCase().includes(q) ||
      (j.district || "").toLowerCase().includes(q)
    );
  }
  return list;
});

async function handleCreate(form: any) {
  try {
    await jobsStore.create(form);
    showForm.value = false;
    ui.notify("สร้างคิวงานแล้ว", "success");
  } catch (e) { ui.notifyError(e); }
}

async function regenerateMagicLink(j: DrillingJob) {
  try {
    const { token } = await jobsApi.generateMagicLink(j.job_id);
    j.magic_link_token = token;
    ui.notify("สร้างลิงก์ช่างใหม่แล้ว", "success");
  } catch (e) { ui.notifyError(e); }
}

function openEdit(j: DrillingJob) {
  editTarget.value = j;
  editForm.value = {
    job_title: j.job_title || "",
    site_address: j.site_address || "",
    province: j.province || "",
    district: j.district || "",
    scheduled_date: j.scheduled_date || "",
    notes: j.notes || "",
  };
  editDlg.value = true;
}

function openSelect(mode: "edit" | "delete") {
  selectMode.value = mode;
  selectDlg.value = true;
  fabOpen.value = false;
}

function pickItem(j: DrillingJob) {
  selectDlg.value = false;
  if (selectMode.value === "edit") {
    openEdit(j);
  } else {
    deleteTarget.value = j;
    deleteDlg.value = true;
  }
}

async function submitEdit() {
  if (!editTarget.value) return;
  try {
    await jobsStore.update(editTarget.value.job_id, editForm.value);
    ui.notify("แก้ไขข้อมูลแล้ว", "success");
    editDlg.value = false;
  } catch (e) { ui.notifyError(e); }
}

async function doDelete() {
  if (!deleteTarget.value) return;
  try {
    await jobsStore.remove(deleteTarget.value.job_id);
    ui.notify("ลบคิวงานแล้ว", "success");
    deleteDlg.value = false;
  } catch (e) { ui.notifyError(e); }
}

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("th-TH", { month: "short", day: "numeric" });
}
</script>

<template>
  <div>
    <!-- Toolbar -->
    <div class="d-flex flex-wrap ga-3 align-center mb-4">
      <v-tabs v-model="tab" density="comfortable" color="primary" class="flex-grow-0" show-arrows>
        <v-tab value="ALL">ทั้งหมด ({{ jobsStore.jobs.length }})</v-tab>
        <v-tab v-for="s in statusTabs" :key="s" :value="s">{{ JOB_STATUS[s].label }} ({{ jobsStore.byStatus(s).length }})</v-tab>
      </v-tabs>
      <v-spacer />
      <v-text-field
        v-model="search" density="compact" variant="outlined" hide-details
        prepend-inner-icon="mdi-magnify"
        placeholder="ค้นหาคิวงาน, ลูกค้า, จังหวัด..."
        style="max-width:280px"
        clearable
      />
      <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" @click="showForm = true">
        เพิ่มคิวงาน
      </v-btn>
    </div>

    <!-- Loading -->
    <div v-if="jobsStore.loading" class="text-center py-10 text-medium-emphasis">
      <v-progress-circular indeterminate color="primary" class="mb-2" /><br />กำลังโหลด...
    </div>

    <!-- Card grid -->
    <v-row v-else>
      <v-col v-for="j in filtered" :key="j.job_id" cols="12" md="6" lg="4">
        <v-card
          variant="outlined"
          class="pa-4 cursor-pointer h-100"
          @click="router.push(`/jobs/${j.job_id}`)"
        >
          <div class="d-flex justify-space-between align-start mb-2">
            <StatusChip :status="j.status" />
            <div v-if="j.scheduled_date" class="text-caption text-medium-emphasis">{{ fmtDate(j.scheduled_date) }}</div>
          </div>

          <div class="font-weight-bold text-body-1 mb-1">{{ j.job_title || `คิวงาน #${j.job_id}` }}</div>

          <div class="text-caption text-medium-emphasis mb-1 d-flex align-center ga-1">
            <v-icon icon="mdi-account-outline" size="14" />
            {{ j.customer_name }}
          </div>
          <div class="text-caption text-medium-emphasis d-flex align-center ga-1">
            <v-icon icon="mdi-map-marker-outline" size="14" />
            {{ j.province ? `${j.province} · ` : "" }}{{ j.site_address || "ไม่ระบุที่ตั้ง" }}
          </div>
          <div class="mt-2" @click.stop>
            <DrillerLinkChip :token="j.magic_link_token || null" path="/d/" @regenerate="regenerateMagicLink(j)" />
          </div>
        </v-card>
      </v-col>

      <v-col v-if="!filtered.length && !jobsStore.loading" cols="12">
        <div class="text-center py-10 text-medium-emphasis">
          <v-icon icon="mdi-hammer-wrench" size="48" class="mb-2 opacity-30" />
          <div>ไม่พบคิวงานที่ตรงกับเงื่อนไข</div>
        </div>
      </v-col>
    </v-row>

    <JobFormDialog
      v-model="showForm"
      :customers="customersStore.customers"
      @submit="handleCreate"
    />

    <!-- FAB Management Menu -->
    <div class="fab-wrapper">
      <v-menu v-model="fabOpen" location="top" :close-on-content-click="true">
        <template v-slot:activator="{ props }">
          <v-btn icon="mdi-cog-outline" color="secondary" v-bind="props" elevation="4" />
        </template>
        <v-list density="compact" class="py-1">
          <v-list-item prepend-icon="mdi-pencil-outline" @click="openSelect('edit')">
            <v-list-item-title>แก้ไขคิวงาน</v-list-item-title>
          </v-list-item>
          <v-list-item prepend-icon="mdi-delete-outline" class="text-error" @click="openSelect('delete')">
            <v-list-item-title>ลบคิวงาน</v-list-item-title>
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
            v-for="j in filtered" :key="j.job_id"
            @click="pickItem(j)"
            class="py-3"
          >
            <template v-slot:prepend>
              <StatusChip :status="j.status" class="mr-2" />
            </template>
            <v-list-item-title class="font-weight-bold">{{ j.job_title || `คิวงาน #${j.job_id}` }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption">{{ j.customer_name }} · {{ j.site_address || "" }}</v-list-item-subtitle>
          </v-list-item>
          <div v-if="!filtered.length" class="text-center py-6 text-medium-emphasis text-body-2">ยังไม่มีคิวงาน</div>
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
        <v-card-title class="pa-4 pb-2 font-display font-weight-bold">แก้ไขคิวงาน</v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <v-text-field v-model="editForm.job_title" label="ชื่องาน" class="mb-3" density="comfortable" variant="outlined" />
          <v-textarea v-model="editForm.site_address" label="ที่ตั้งหน้างาน" rows="2" class="mb-3" density="comfortable" variant="outlined" />
          <v-row dense>
            <v-col cols="6"><v-text-field v-model="editForm.province" label="จังหวัด" density="comfortable" variant="outlined" /></v-col>
            <v-col cols="6"><v-text-field v-model="editForm.district" label="อำเภอ" density="comfortable" variant="outlined" /></v-col>
          </v-row>
          <v-text-field v-model="editForm.scheduled_date" type="date" label="วันที่กำหนด" class="mb-3" density="comfortable" variant="outlined" />
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
        <v-card-text>ต้องการลบ <strong>{{ deleteTarget?.job_title || `คิวงาน #${deleteTarget?.job_id}` }}</strong> ใช่หรือไม่?</v-card-text>
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
