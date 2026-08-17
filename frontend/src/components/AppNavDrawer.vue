<script setup lang="ts">
import { useRouter } from "vue-router";
import { router } from "@/router";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const vueRouter = useRouter();

const navItems = router.getRoutes()
  .filter((r) => r.meta?.label && !r.meta?.hidden)
  .map((r) => ({ to: r.path, label: r.meta.label as string, icon: r.meta.icon as string }));

function handleLogout() {
  auth.logout();
  vueRouter.push("/login");
}
</script>

<template>
  <v-navigation-drawer permanent expand-on-hover rail rail-width="72" width="220">
    <v-list nav density="comfortable">
      <v-list-item class="mb-2">
        <template #prepend>
          <v-avatar rounded="lg" size="34" class="brand-tile">
            <v-icon icon="mdi-layers-triple" size="22" />
          </v-avatar>
        </template>
        <v-list-item-title class="font-display font-weight-bold text-body-1">บ่อบาดาล</v-list-item-title>
        <v-list-item-subtitle class="text-caption">Well-Drilling</v-list-item-subtitle>
      </v-list-item>
      <v-divider class="mb-2" />
      <v-list-item
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :prepend-icon="item.icon"
        :title="item.label"
        rounded="lg"
      />
    </v-list>

    <template #append>
      <div class="pa-2">
        <v-list nav density="comfortable">
          <v-list-item prepend-icon="mdi-logout" title="ออกจากระบบ" rounded="lg" @click="handleLogout" />
        </v-list>
      </div>
    </template>
  </v-navigation-drawer>
</template>
