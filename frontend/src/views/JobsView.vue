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
  </div>
</template>
