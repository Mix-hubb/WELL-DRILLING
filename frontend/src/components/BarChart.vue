<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  segments: { label: string; value: number; color: string }[];
  height?: number;
}>();

const height = props.height || 180;
const max = computed(() => Math.max(...props.segments.map((s) => s.value), 1));
const total = computed(() => props.segments.reduce((s, x) => s + x.value, 0));
</script>

<template>
  <div>
    <div class="d-flex align-end ga-4 px-2" :style="{ height: `${height}px` }">
      <div
        v-for="(s, i) in segments"
        :key="i"
        class="d-flex flex-column align-center justify-end flex-grow-1"
        style="min-width: 0; height: 100%"
      >
        <span class="font-mono font-weight-bold text-caption mb-1">{{ s.value }}</span>
        <div
          class="bar-chart-bar w-100"
          :style="{
            background: s.color,
            height: max ? `${Math.max((s.value / max) * (height - 40), s.value > 0 ? 4 : 0)}px` : '0px',
          }"
        />
      </div>
    </div>
    <div class="d-flex ga-4 px-2 mt-2">
      <div v-for="(s, i) in segments" :key="i" class="flex-grow-1 text-center" style="min-width: 0">
        <span class="text-caption text-medium-emphasis text-truncate d-inline-block" style="max-width: 100%">
          {{ s.label }}
        </span>
      </div>
    </div>
    <div class="text-caption text-medium-emphasis mt-2 px-2">
      รวมทั้งหมด <span class="font-mono font-weight-bold">{{ total }}</span>
    </div>
  </div>
</template>

<style scoped>
.bar-chart-bar {
  border-radius: 6px 6px 2px 2px;
  transition: height 0.3s ease;
}
</style>
