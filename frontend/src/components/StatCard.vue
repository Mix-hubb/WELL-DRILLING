<script setup lang="ts">
defineProps<{
  label: string;
  value: string;
  icon: string;
  color?: string;
  sub?: string;
}>();
</script>

<template>
  <v-card class="pa-4 h-100" variant="outlined">
    <div class="d-flex align-center justify-space-between mb-2">
      <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold">{{ label }}</span>
      <v-avatar :color="color || 'primary'" variant="tonal" size="34">
        <v-icon :icon="icon" size="18" />
      </v-avatar>
    </div>
    <div class="text-h5 font-weight-bold font-mono">{{ value }}</div>
    <div v-if="sub" class="text-caption text-medium-emphasis mt-1">{{ sub }}</div>
  </v-card>
</template>
