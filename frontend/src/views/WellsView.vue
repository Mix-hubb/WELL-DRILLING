<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useCustomersStore } from "@/stores/customers";
import { useWellsStore } from "@/stores/wells";
import { useUiStore } from "@/stores/ui";
import { useSSERefresh } from "@/composables/useSSERefresh";
import CustomerFormDialog from "@/components/forms/CustomerFormDialog.vue";
import type { Customer } from "@/types";

const router = useRouter();
const customersStore = useCustomersStore();
const wellsStore = useWellsStore();
const ui = useUiStore();
const search = ref("");

// Dialog states
const showDialog = ref(false);
const editingCustomer = ref<Customer | null>(null);
const deleteConfirmDialog = ref(false);
const customerToDelete = ref<Customer | null>(null);

async function refresh() {
  try {
    await Promise.all([customersStore.fetchAll(), wellsStore.fetchAll()]);
  } catch (e) { ui.notifyError(e); }
}

useSSERefresh(refresh, [
  "WELL_CREATED",
  "WELL_UPDATED",
  "WELL_DELETED",
  "JOB_STATUS_CHANGED",
  "DRILLING_REQUEST_CHANGED",
  "REPAIR_REQUEST_CHANGED",
  "CUSTOMER_CREATED",
  "CUSTOMER_UPDATED",
  "CUSTOMER_DELETED",
]);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return customersStore.customers;
  return customersStore.customers.filter(
    (c) => c.customer_name.toLowerCase().includes(q) || (c.phone || "").includes(q)
  );
});

const wellCountsByCustomerId = computed(() => {
  const map = new Map<number, number>();
  for (const w of wellsStore.wells) {
    if (w.customer_id != null) {
      map.set(w.customer_id, (map.get(w.customer_id) || 0) + 1);
    }
  }
  return map;
});

function wellCount(customerId: number): number {
  return wellCountsByCustomerId.value.get(customerId) || 0;
}

function openEditDialog(c: Customer) {
  editingCustomer.value = c;
  showDialog.value = true;
}

function confirmDelete(c: Customer) {
  customerToDelete.value = c;
  deleteConfirmDialog.value = true;
}

async function handleSave(data: Partial<Customer>) {
  if (!editingCustomer.value?.customer_id) return;
  try {
    await customersStore.update(editingCustomer.value.customer_id, data);
    ui.notify("แก้ไขข้อมูลลูกค้าเรียบร้อยแล้ว", "success");
    showDialog.value = false;
  } catch (e) {
    ui.notifyError(e);
  }
}

async function handleDelete() {
  if (!customerToDelete.value?.customer_id) return;
  try {
    await customersStore.remove(customerToDelete.value.customer_id);
    ui.notify("ลบลูกค้าเรียบร้อยแล้ว", "success");
    deleteConfirmDialog.value = false;
    customerToDelete.value = null;
  } catch (e) {
    ui.notifyError(e);
  }
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
        class="page-head-search"
        style="max-width: 360px"
      />
    </div>

    <v-row v-if="!customersStore.loading">
      <v-col v-for="c in filtered" :key="c.customer_id" cols="12" sm="6" md="4">
        <v-card variant="outlined" class="pa-4 h-100 cursor-pointer" @click="router.push(`/wells/customer/${c.customer_id}`)">
          <div class="d-flex align-center justify-space-between mb-2">
            <div class="d-flex align-center ga-3">
              <v-avatar v-if="c.line_picture_url" size="42">
                <v-img :src="c.line_picture_url" alt="" />
              </v-avatar>
              <v-avatar v-else color="primary" variant="tonal" size="42">
                <v-icon icon="mdi-account-outline" />
              </v-avatar>
              <div class="font-weight-bold">{{ c.customer_name }}</div>
            </div>
            <div class="d-flex ga-1" @click.stop>
              <v-btn icon="mdi-pencil-outline" size="x-small" variant="text" color="medium-emphasis" @click="openEditDialog(c)" />
              <v-btn icon="mdi-delete-outline" size="x-small" variant="text" color="error" @click="confirmDelete(c)" />
            </div>
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

    <!-- Edit Customer Dialog -->
    <CustomerFormDialog
      v-model="showDialog"
      :customer="editingCustomer"
      @submit="handleSave"
    />

    <!-- Delete Confirmation Dialog -->
    <v-dialog v-model="deleteConfirmDialog" max-width="400">
      <v-card>
        <v-card-title class="pa-4 font-display font-weight-bold text-error">
          ยืนยันการลบลูกค้า
        </v-card-title>
        <v-card-text class="pa-4">
          คุณแน่ใจหรือไม่ว่าต้องการลบ <strong>{{ customerToDelete?.customer_name }}</strong> ออกจากระบบ?
        </v-card-text>
        <v-card-actions class="pa-4 ga-2">
          <v-spacer />
          <v-btn variant="text" @click="deleteConfirmDialog = false">ยกเลิก</v-btn>
          <v-btn color="error" variant="flat" @click="handleDelete">ลบข้อมูล</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

