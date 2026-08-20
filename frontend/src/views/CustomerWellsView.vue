<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { customersApi, type CustomerOverview } from "@/api/customers";
import { useUiStore } from "@/stores/ui";
import { DRILLING_METHOD } from "@/constants";

const route = useRoute();
const router = useRouter();
const ui = useUiStore();

const loading = ref(true);
const data = ref<CustomerOverview | null>(null);

const customer = computed(() => data.value?.customer);

onMounted(async () => {
  try {
    data.value = await customersApi.overview(route.params.id as string);
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
});

function fmtDate(d?: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}
</script>

<template>
  <div>
    <v-btn variant="text" prepend-icon="mdi-arrow-left" size="small" class="mb-2" @click="router.push('/wells')">
      กลับไปรายชื่อลูกค้า
    </v-btn>

    <div v-if="loading" class="text-center py-10 text-medium-emphasis">กำลังโหลด...</div>

    <template v-else-if="customer">
      <v-card class="pa-4 mb-4">
        <div class="d-flex flex-wrap align-center ga-4">
          <v-avatar v-if="customer.line_picture_url" size="56">
            <v-img :src="customer.line_picture_url" alt="" />
          </v-avatar>
          <v-avatar v-else size="56" color="primary" variant="tonal">
            <v-icon icon="mdi-account-outline" size="32" />
          </v-avatar>
          <div>
            <div class="text-h6 font-display font-weight-bold">{{ customer.customer_name }}</div>
            <div class="text-caption text-medium-emphasis">
              <v-icon icon="mdi-phone-outline" size="14" /> {{ customer.phone }}
              <template v-if="customer.phone_alt"> · {{ customer.phone_alt }}</template>
            </div>
          </div>
          <v-spacer />
          <div v-if="customer.address" class="text-caption text-medium-emphasis text-right">
            <v-icon icon="mdi-map-marker-outline" size="14" /> {{ customer.address }}
          </div>
        </div>
      </v-card>

      <div class="text-subtitle-1 font-display font-weight-bold mb-3">
        บ่อบาดาลทั้งหมด ({{ data?.wells.length ?? 0 }})
      </div>

      <v-row v-if="data?.wells.length">
        <v-col v-for="w in data.wells" :key="w.well_id" cols="12" sm="6" md="4">
          <v-card variant="outlined" class="pa-4 h-100 cursor-pointer" @click="router.push(`/wells/${w.well_id}`)">
            <div class="d-flex align-center ga-3 mb-3">
              <v-avatar color="primary" variant="tonal" size="42">
                <v-icon icon="mdi-water-outline" />
              </v-avatar>
              <div class="text-body-1 font-weight-bold">{{ w.well_name || `บ่อบาดาล #${w.well_id}` }}</div>
            </div>
            <div class="d-flex ga-4 text-caption text-medium-emphasis">
              <span><v-icon icon="mdi-ruler" size="14" /> {{ w.total_depth_m ?? "-" }} ม.</span>
              <span v-if="w.water_quantity_m3hr"><v-icon icon="mdi-gauge" size="14" /> {{ w.water_quantity_m3hr }} ม³/ชม.</span>
              <span v-if="w.drilling_method">{{ DRILLING_METHOD[w.drilling_method] }}</span>
            </div>
            <div class="d-flex align-center ga-2 mt-3">
              <span v-if="w.warranty_status" class="text-caption">
                <v-icon icon="mdi-shield-outline" size="14" />
                <span :style="w.warranty_status === 'EXPIRED' ? 'color:var(--v-theme-error)' : 'color:var(--v-theme-success)'">
                  {{ w.warranty_status === "EXPIRED" ? "หมดประกัน" : "ในประกัน" }}
                </span>
              </span>
              <v-btn size="x-small" variant="text" color="primary" append-icon="mdi-arrow-right" class="ml-auto">
                ดูรายละเอียด
              </v-btn>
            </div>
          </v-card>
        </v-col>
      </v-row>
      <div v-else class="text-center py-10 text-medium-emphasis">ลูกค้ารายนี้ยังไม่มีบ่อบาดาล</div>
    </template>

    <v-card v-else class="pa-6 text-center">
      <v-icon icon="mdi-account-alert-outline" size="40" class="mb-2" />
      <div class="text-h6 font-display font-weight-bold">ไม่พบลูกค้า</div>
    </v-card>
  </div>
</template>
