<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useCustomersStore } from "@/stores/customers";
import { useWellsStore } from "@/stores/wells";
import { useUiStore } from "@/stores/ui";
import { useSSE } from "@/composables/useSSE";

const router = useRouter();
const customersStore = useCustomersStore();
const wellsStore = useWellsStore();
const ui = useUiStore();
const { connect, on } = useSSE();

const search = ref("");

async function refresh() {
  try {
    await Promise.all([customersStore.fetchAll(), wellsStore.fetchAll()]);
  } catch (e) { ui.notifyError(e); }
}

onMounted(async () => {
  await refresh();
  connect();
  on("WELL_CREATED", refresh);
  on("WELL_UPDATED", refresh);
  on("DRILLING_REQUEST_CHANGED", refresh);
  on("REPAIR_REQUEST_CHANGED", refresh);
  on("CUSTOMER_CREATED", refresh);
  on("CUSTOMER_UPDATED", refresh);
  on("CUSTOMER_DELETED", refresh);
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return customersStore.customers;
  return customersStore.customers.filter(
    (c) => c.customer_name.toLowerCase().includes(q) || (c.phone || "").includes(q)
  );
});

function wellCount(customerId: number | string) {
  return wellsStore.wells.filter((w) => String(w.customer_id) === String(customerId)).length;
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap ga-3 align-center mb-4">
      <v-text-field
        v-model="search"
        density="compact"
        variant="outlined"
        hide-details
        prepend-inner-icon="mdi-magnify"
        placeholder="ค้นหาจากชื่อลูกค้า หรือเบอร์โทร..."
        style="max-width: 360px"
      />
    </div>

    <v-row v-if="!customersStore.loading">
      <v-col v-for="c in filtered" :key="c.customer_id" cols="12" sm="6" md="4">
        <v-card variant="outlined" class="pa-4 h-100 cursor-pointer" @click="router.push(`/wells/customer/${c.customer_id}`)">
          <div class="d-flex align-center ga-3 mb-2">
            <v-avatar v-if="c.line_picture_url" size="42">
              <v-img :src="c.line_picture_url" alt="" />
            </v-avatar>
            <v-avatar v-else color="primary" variant="tonal" size="42">
              <v-icon icon="mdi-account-outline" />
            </v-avatar>
            <div class="font-weight-bold">{{ c.customer_name }}</div>
          </div>
          <div class="text-caption text-medium-emphasis">
            <v-icon icon="mdi-phone-outline" size="14" /> {{ c.phone }}
          </div>
          <div v-if="c.address" class="text-caption text-medium-emphasis mt-1">
            <v-icon icon="mdi-map-marker-outline" size="14" /> {{ c.address }}
          </div>
          <div class="d-flex align-center ga-2 mt-3">
            <v-chip size="small" color="primary" variant="tonal">{{ wellCount(c.customer_id) }} บ่อ</v-chip>
            <v-btn size="x-small" variant="text" color="primary" append-icon="mdi-arrow-right" class="ml-auto">
              ดูประวัติบ่อ
            </v-btn>
          </div>
        </v-card>
      </v-col>
      <v-col v-if="!filtered.length" cols="12">
        <div class="text-center py-10 text-medium-emphasis">ไม่พบลูกค้า</div>
      </v-col>
    </v-row>
  </div>
</template>
