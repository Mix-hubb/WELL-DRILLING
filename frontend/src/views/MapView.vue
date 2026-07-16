<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useJobsStore } from "@/stores/jobs";
import { useUiStore } from "@/stores/ui";
import { STATUS } from "@/constants";
import JobMap from "@/components/JobMap.vue";
import type { JobStatus } from "@/types";

const jobsStore = useJobsStore();
const ui = useUiStore();
const activeFilters = ref<JobStatus[]>(["PENDING", "DRILLING", "COMPLETED"]);

onMounted(async () => {
  try { await jobsStore.fetchAll(); } catch (e) { ui.notifyError(e); }
});

const filteredJobs = computed(() => jobsStore.jobs.filter((j) => activeFilters.value.includes(j.status)));
</script>

<template>
  <div>
    <div class="d-flex flex-wrap align-center ga-2 mb-4">
      <span class="text-subtitle-1 font-display font-weight-bold mr-2">แผนที่คิวงาน</span>
      <v-chip-group v-model="activeFilters" multiple filter color="primary">
        <v-chip v-for="s in (['PENDING','DRILLING','COMPLETED'] as JobStatus[])" :key="s" :value="s" variant="outlined">
          {{ STATUS[s].label }}
        </v-chip>
      </v-chip-group>
    </div>
    <v-card variant="outlined" class="pa-2" style="height: 70vh;">
      <JobMap :jobs="filteredJobs" />
    </v-card>
  </div>
</template>
