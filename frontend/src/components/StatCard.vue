<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  label: string;
  value: string;
  icon: string;
  color?: string;
  sub?: string;
}>();

const color = computed(() => props.color || "primary");
const tileStyle = computed(() => ({
  background: `rgb(var(--v-theme-${color.value}) / 0.14)`,
}));
</script>

<template>
  <v-card class="stat-card pa-4 h-100" variant="outlined">
    <div class="d-flex align-center justify-space-between mb-3">
      <span class="text-caption text-medium-emphasis text-uppercase font-weight-bold">{{ label }}</span>
      <div class="stat-tile" :style="tileStyle">
        <v-icon :icon="icon" size="20" :color="color" />
      </div>
    </div>
    <div class="text-h5 font-weight-bold font-mono">{{ value }}</div>
    <div v-if="sub" class="text-caption text-medium-emphasis mt-1">{{ sub }}</div>
  </v-card>
</template>

<style scoped>
.stat-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  flex-shrink: 0;
}
</style>
