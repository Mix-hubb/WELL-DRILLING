<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { warrantyApi, type WarrantyRecord, type WarrantySummary } from "@/api/warranty";
import { useUiStore } from "@/stores/ui";
import WarrantyBadge from "@/components/WarrantyBadge.vue";

const ui     = useUiStore();
const router = useRouter();

const records  = ref<WarrantyRecord[]>([]);
const summary  = ref<WarrantySummary>({ total: 0, active: 0, expiringSoon: 0, expired: 0 });
const loading  = ref(true);
const filter   = ref<"" | "active" | "expiring" | "expired">("");
const search   = ref("");

async function load() {
  loading.value = true;
  try {
    const [r, s] = await Promise.all([
      warrantyApi.list(filter.value || undefined),
      warrantyApi.summary(),
    ]);
    records.value = r;
    summary.value = s;
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

const filtered = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) return records.value;
  return records.value.filter(
    (r) =>
      r.customer_name.toLowerCase().includes(q) ||
      r.customer_phone.includes(q) ||
      r.job_reference.toLowerCase().includes(q) ||
      r.province.includes(q)
  );
});

function fmtDate(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}
function cardClass(tier: string) {
  if (tier === "ACTIVE")        return "warranty-active";
  if (tier === "EXPIRING_SOON") return "warranty-expiring";
  return "warranty-expired";
}
</script>

<template>
  <div style="max-width:960px">
    <h1 class="text-h5 font-display font-weight-bold mb-1">ระบบติดตามประกัน 2 ปี</h1>
    <div class="text-caption text-medium-emphasis mb-4">
      อัปเดตล่าสุด: {{ new Date().toLocaleDateString("th-TH") }}
    </div>

    <!-- Summary Cards -->
    <v-row class="mb-4">
      <v-col cols="6" md="3">
        <v-card class="pa-4 text-center" :border="true">
          <div class="text-h4 font-mono font-weight-bold text-success">{{ summary.active }}</div>
          <div class="text-caption text-medium-emphasis mt-1">ในประกัน</div>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card class="pa-4 text-center" :border="true">
          <div class="text-h4 font-mono font-weight-bold text-warning">{{ summary.expiringSoon }}</div>
          <div class="text-caption text-medium-emphasis mt-1">ใกล้หมด (&le;30 วัน)</div>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card class="pa-4 text-center" :border="true">
          <div class="text-h4 font-mono font-weight-bold text-error">{{ summary.expired }}</div>
          <div class="text-caption text-medium-emphasis mt-1">หมดประกันแล้ว</div>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card class="pa-4 text-center" :border="true">
          <div class="text-h4 font-mono font-weight-bold">{{ summary.total }}</div>
          <div class="text-caption text-medium-emphasis mt-1">บ่อทั้งหมด</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Filter + Search bar -->
    <div class="d-flex ga-2 mb-4 flex-wrap">
      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        placeholder="ค้นหาชื่อลูกค้า, โทร, รหัสงาน, จังหวัด"
        hide-details clearable
        style="max-width:360px"
      />
      <v-btn-toggle v-model="filter" @update:model-value="load" rounded="lg" mandatory density="comfortable">
        <v-btn value="">ทั้งหมด</v-btn>
        <v-btn value="active" color="success">ในประกัน</v-btn>
        <v-btn value="expiring" color="warning">ใกล้หมด</v-btn>
        <v-btn value="expired" color="error">หมดแล้ว</v-btn>
      </v-btn-toggle>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-10 text-medium-emphasis">
      <v-progress-circular indeterminate color="primary" class="mb-3" /><br />กำลังโหลด...
    </div>

    <!-- Records List -->
    <div v-else-if="!filtered.length" class="text-center py-10 text-medium-emphasis">
      <v-icon icon="mdi-shield-search" size="48" class="mb-2 opacity-30" />
      <div>ไม่พบรายการ</div>
    </div>

    <v-row v-else>
      <v-col v-for="r in filtered" :key="r.well_id" cols="12" md="6">
        <v-card
          class="pa-4 cursor-pointer"
          :class="cardClass(r.alert_tier)"
          @click="router.push(`/wells/${r.well_id}`)"
        >
          <!-- Header -->
          <div class="d-flex justify-space-between align-start mb-2">
            <div>
              <div class="font-weight-semibold text-body-1">{{ r.customer_name }}</div>
              <div class="text-caption text-medium-emphasis">{{ r.job_reference }} · {{ r.province }}</div>
            </div>
            <WarrantyBadge
              :alert-tier="r.alert_tier"
              :remaining-days="r.remaining_days"
              :expiry-date="r.warranty_expire_date"
              small
            />
          </div>

          <!-- Info grid -->
          <v-divider class="mb-2" />
          <div class="d-flex ga-4 text-caption flex-wrap">
            <div>
              <div class="text-medium-emphasis">วันเสร็จ</div>
              <div class="font-mono font-weight-medium">{{ fmtDate(r.completion_date) }}</div>
            </div>
            <div>
              <div class="text-medium-emphasis">หมดประกัน</div>
              <div class="font-mono font-weight-medium">{{ fmtDate(r.warranty_expire_date) }}</div>
            </div>
            <div>
              <div class="text-medium-emphasis">ความลึก</div>
              <div class="font-mono font-weight-medium">{{ r.total_depth }} ม.</div>
            </div>
            <div v-if="r.yield_lpm">
              <div class="text-medium-emphasis">อัตราไหล</div>
              <div class="font-mono font-weight-medium">{{ r.yield_lpm }} L/min</div>
            </div>
          </div>

          <!-- Phone -->
          <div class="d-flex align-center ga-1 mt-2 text-caption">
            <v-icon icon="mdi-phone-outline" size="14" color="primary" />
            <a :href="`tel:${r.customer_phone}`" @click.stop class="text-primary">{{ r.customer_phone }}</a>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
