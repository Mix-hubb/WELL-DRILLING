<script setup lang="ts">
import { router } from "@/router";

const navItems = router.getRoutes()
  .filter((r) => r.meta?.label && !r.meta?.hidden)
  .map((r) => ({ to: r.path, label: r.meta.label as string, icon: r.meta.icon as string }));
</script>

<template>
  <v-navigation-drawer permanent expand-on-hover rail rail-width="72" width="220">
    <v-list nav density="comfortable">
      <v-list-item class="mb-2">
        <template #prepend>
          <v-icon icon="mdi-layers-triple" color="primary" size="28" />
        </template>
        <v-list-item-title class="font-display font-weight-bold text-body-1">บ่อบาดาล</v-list-item-title>
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
  </v-navigation-drawer>
</template>
