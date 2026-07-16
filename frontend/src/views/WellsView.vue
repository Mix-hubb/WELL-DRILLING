<script setup lang="ts">
import { onMounted } from "vue";
import { useRouter } from "vue-router";
import { useWellsStore } from "@/stores/wells";
import { useUiStore } from "@/stores/ui";

const router = useRouter();
const wellsStore = useWellsStore();
const ui = useUiStore();

onMounted(async () => {
  try { await wellsStore.fetchAll(); } catch (e) { ui.notifyError(e); }
});
</script>

<template>
  <div>
    <div v-if="wellsStore.loading" class="text-center py-10 text-medium-emphasis">กำลังโหลด...</div>
    <v-row v-else>
      <v-col v-for="w in wellsStore.wells" :key="w.well_id" cols="12" sm="6" md="4">
        <v-card variant="outlined" class="pa-4 cursor-pointer h-100" @click="router.push(`/wells/${w.well_id}`)">
          <div class="d-flex align-center ga-3 mb-3">
            <v-avatar color="primary" variant="tonal" size="42">
              <v-icon icon="mdi-water-outline" />
            </v-avatar>
            <div class="text-body-1 font-weight-bold">{{ w.job_title }}</div>
          </div>
          <div class="d-flex ga-4 text-caption text-medium-emphasis">
            <span><v-icon icon="mdi-ruler" size="14" /> {{ w.total_depth }} ม.</span>
            <span><v-icon icon="mdi-gauge" size="14" /> {{ w.water_quantity }} ม³/ชม.</span>
          </div>
        </v-card>
      </v-col>
      <v-col v-if="!wellsStore.wells.length" cols="12">
        <div class="text-center py-10 text-medium-emphasis">ยังไม่มีประวัติบ่อบาดาลที่เจาะสำเร็จ</div>
      </v-col>
    </v-row>
  </div>
</template>
