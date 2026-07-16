<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  bars: { label: string; value: number; color?: string }[];
  unit?: string;
}>();

const max = computed(() => Math.max(...props.bars.map((b) => b.value), 1));
</script>

<template>
  <div class="d-flex flex-column ga-2">
    <div v-for="(b, i) in bars" :key="i">
      <div class="d-flex justify-space-between text-caption mb-1">
        <span>{{ b.label }}</span>
        <span class="font-mono font-weight-bold">{{ b.value }}{{ unit || "" }}</span>
      </div>
      <div class="rounded-pill" style="height: 8px; background: rgba(128,128,128,0.15); overflow: hidden;">
        <div
          class="rounded-pill h-100"
          :style="{ width: `${(b.value / max) * 100}%`, background: b.color || 'rgb(var(--v-theme-primary))', transition: 'width .4s ease' }"
        />
      </div>
    </div>
  </div>
</template>
