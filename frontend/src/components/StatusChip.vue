<script setup lang="ts">
import type { JobStatus } from "@/types";
import { STATUS } from "@/constants";

defineProps<{ status: JobStatus; size?: "small" | "default" }>();
</script>

<template>
  <v-chip :color="STATUS[status].color" :size="size || 'small'" variant="tonal" class="font-weight-bold">
    {{ STATUS[status].label }}
  </v-chip>
</template>
