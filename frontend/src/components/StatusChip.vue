<script setup lang="ts">
import { computed } from "vue";
import { JOB_STATUS, REQUEST_STATUS, REPAIR_STATUS, QUOTATION_STATUS } from "@/constants";

const props = defineProps<{ status: string; size?: "small" | "x-small" | "default" }>();

const lookup = {
  ...JOB_STATUS,
  ...REQUEST_STATUS,
  ...REPAIR_STATUS,
  ...QUOTATION_STATUS,
} as Record<string, { label: string; color: string }>;

const meta = computed(() => lookup[props.status] || { label: props.status, color: "grey" });
</script>

<template>
  <v-chip :color="meta.color" :size="size || 'small'" variant="tonal" class="font-weight-bold">
    {{ meta.label }}
  </v-chip>
</template>
