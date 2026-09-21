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
  { to: "/settings",        label: "ตั้งค่าระบบ",     icon: "mdi-cog-outline" },
];

const MORE_VALUE = "__more__";

const activeValue = computed(() => {
  const primaryMatch = primary.find((p) => route.path.startsWith(p.to));
  if (primaryMatch) return primaryMatch.to;
  const moreMatch = more.find((p) => route.path.startsWith(p.to));
  return moreMatch ? MORE_VALUE : undefined;
});

function goMore(to: string) {
  moreMenu.value = false;
  router.push(to);
}
</script>

<template>
  <v-bottom-navigation
    grow :model-value="activeValue" color="primary" mode="shift"
    class="app-bottom-nav"
  >
    <v-btn v-for="item in primary" :key="item.to" :to="item.to" :value="item.to">
      <v-icon :icon="item.icon" />
      <span class="text-caption nav-label">{{ item.label }}</span>
    </v-btn>

    <v-menu v-model="moreMenu" location="top">
      <template #activator="{ props }">
        <v-btn v-bind="props" :value="MORE_VALUE">
          <v-icon icon="mdi-dots-horizontal" />
          <span class="text-caption nav-label">เพิ่มเติม</span>
        </v-btn>
      </template>
      <v-list density="comfortable" bg-color="surface-bright" elevation="8" rounded="lg" class="popover-list">
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

.nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
</style>
