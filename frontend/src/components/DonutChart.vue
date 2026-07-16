<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  segments: { label: string; value: number; color: string }[];
  size?: number;
}>();

const size = props.size || 160;
const radius = size / 2 - 14;
const circumference = 2 * Math.PI * radius;
const total = computed(() => props.segments.reduce((s, x) => s + x.value, 0) || 1);

const arcs = computed(() => {
  let offset = 0;
  return props.segments.map((s) => {
    const fraction = s.value / total.value;
    const dash = fraction * circumference;
    const arc = { ...s, dash, gap: circumference - dash, offset: -offset, fraction };
    offset += dash;
    return arc;
  });
});
</script>

<template>
  <div class="d-flex align-center ga-4 flex-wrap">
    <svg
      :width="size" :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      style="max-width:100%;height:auto"
    >
      <g :transform="`translate(${size / 2}, ${size / 2}) rotate(-90)`">
        <circle
          v-for="(a, i) in arcs"
          :key="i"
          :r="radius"
          fill="none"
          :stroke="a.color"
          stroke-width="16"
          :stroke-dasharray="`${a.dash} ${a.gap}`"
          :stroke-dashoffset="a.offset"
          stroke-linecap="butt"
        />
      </g>
      <text x="50%" y="48%" text-anchor="middle" class="font-mono" font-size="22" font-weight="700" fill="currentColor">
        {{ total }}
      </text>
      <text x="50%" y="62%" text-anchor="middle" font-size="10" fill="currentColor" opacity="0.6">
        รวมทั้งหมด
      </text>
    </svg>
    <div class="d-flex flex-column ga-1">
      <div v-for="(s, i) in segments" :key="i" class="d-flex align-center ga-2 text-caption">
        <span class="rounded-circle" :style="{ width: '10px', height: '10px', background: s.color, display: 'inline-block' }" />
        <span>{{ s.label }}</span>
        <span class="font-weight-bold font-mono ml-1">{{ s.value }}</span>
      </div>
    </div>
  </div>
</template>
