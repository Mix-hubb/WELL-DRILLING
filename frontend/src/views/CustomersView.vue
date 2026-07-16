<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useCustomersStore } from "@/stores/customers";
import { useJobsStore } from "@/stores/jobs";
import { useUiStore } from "@/stores/ui";
import CustomerFormDialog from "@/components/forms/CustomerFormDialog.vue";

const customersStore = useCustomersStore();
const jobsStore = useJobsStore();
const ui = useUiStore();

const search = ref("");
const showForm = ref(false);

onMounted(async () => {
  try { await Promise.all([customersStore.fetchAll(), jobsStore.fetchAll()]); } catch (e) { ui.notifyError(e); }
});

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return customersStore.customers;
  return customersStore.customers.filter((c) => c.customer_name.toLowerCase().includes(q) || c.phone.includes(q));
});

function jobCount(customerId: number) {
  return jobsStore.jobs.filter((j) => j.customer_id === customerId).length;
}

async function handleCreate(form: any) {
  try {
    await customersStore.create(form);
    showForm.value = false;
    ui.notify("เพิ่มลูกค้าแล้ว", "success");
  } catch (e) { ui.notifyError(e); }
}
</script>

<template>
  <div>
    <div class="d-flex flex-wrap ga-3 align-center mb-4">
      <v-text-field v-model="search" density="compact" variant="outlined" hide-details prepend-inner-icon="mdi-magnify" placeholder="ค้นหาลูกค้า..." style="max-width: 280px" />
      <v-spacer />
      <v-btn color="primary" variant="flat" prepend-icon="mdi-plus" @click="showForm = true">เพิ่มลูกค้า</v-btn>
    </div>

    <v-row v-if="!customersStore.loading">
      <v-col v-for="c in filtered" :key="c.customer_id" cols="12" sm="6" md="4">
        <v-card variant="outlined" class="pa-4 h-100">
          <div class="font-weight-bold mb-1">{{ c.customer_name }}</div>
          <div class="text-caption text-medium-emphasis"><v-icon icon="mdi-phone-outline" size="14" /> {{ c.phone }}</div>
          <div v-if="c.address" class="text-caption text-medium-emphasis mt-1"><v-icon icon="mdi-map-marker-outline" size="14" /> {{ c.address }}</div>
          <v-chip size="small" color="primary" variant="tonal" class="mt-3">{{ jobCount(c.customer_id) }} งาน</v-chip>
        </v-card>
      </v-col>
      <v-col v-if="!filtered.length" cols="12">
        <div class="text-center py-10 text-medium-emphasis">ไม่พบลูกค้า</div>
      </v-col>
    </v-row>

    <CustomerFormDialog v-model="showForm" @submit="handleCreate" />
  </div>
</template>
