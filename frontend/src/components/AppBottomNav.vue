<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const route  = useRoute();
const router = useRouter();
const moreMenu = ref(false);

// 4 ปุ่มหลัก mobile bottom nav
const primary = [
  { to: "/dashboard",          label: "แดชบอร์ด",   icon: "mdi-view-dashboard-outline" },
  { to: "/jobs",               label: "คิวงาน",     icon: "mdi-hammer-wrench" },
  { to: "/drilling-requests",  label: "คำร้องเจาะ", icon: "mdi-file-document-plus-outline" },
  { to: "/wells",              label: "ประวัติบ่อ",  icon: "mdi-layers-outline" },
];

const more = [
  { to: "/repair-requests", label: "รายการแจ้งซ่อม", icon: "mdi-wrench-outline" },
];

const activeIndex = computed(() => {
  const i = primary.findIndex((p) => route.path.startsWith(p.to));
  return i === -1 ? false : i;
});

function goMore(to: string) {
  moreMenu.value = false;
  router.push(to);
}
</script>

<template>
  <v-bottom-navigation
    grow :model-value="activeIndex" color="primary" mode="shift"
    class="app-bottom-nav"
  >
    <v-btn v-for="item in primary" :key="item.to" :to="item.to" :value="item.to">
      <v-icon :icon="item.icon" />
      <span class="text-caption">{{ item.label }}</span>
    </v-btn>

    <v-menu v-model="moreMenu" location="top">
      <template #activator="{ props }">
        <v-btn v-bind="props">
          <v-icon icon="mdi-dots-horizontal" />
          <span class="text-caption">เพิ่มเติม</span>
        </v-btn>
      </template>
      <v-list density="comfortable">
        <v-list-item
          v-for="item in more" :key="item.to"
          :prepend-icon="item.icon"
          :title="item.label"
          @click="goMore(item.to)"
        />
      </v-list>
    </v-menu>
  </v-bottom-navigation>
</template>

<style scoped>
.app-bottom-nav {
  padding-bottom: var(--safe-bottom, 0px);
}
</style>
