<script setup lang="ts">
import type { MaintenanceLog } from "@/api/maintenance";

defineProps<{
  logs: MaintenanceLog[];
  loading?: boolean;
}>();
defineEmits<{ (e: "delete", id: number): void }>();

function fmtDate(d: string) {
  if (!d) return "-";
  const dt = new Date(d);
  return dt.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}
</script>

<template>
  <div>
    <div v-if="loading" class="text-center py-6 text-medium-emphasis">กำลังโหลด...</div>

    <div v-else-if="!logs.length" class="text-center py-8 text-medium-emphasis">
      <v-icon icon="mdi-tools" size="40" class="mb-2 opacity-30" />
      <div>ยังไม่มีประวัติซ่อมบำรุง</div>
    </div>

    <div v-else>
      <div
        v-for="(log, idx) in logs"
        :key="log.maintenance_id"
        class="d-flex ga-3"
      >
        <!-- Timeline track -->
        <div class="d-flex flex-column align-center flex-shrink-0" style="width:18px">
          <div class="timeline-dot" :style="{ background: log.is_warranty_claim ? '#7A3A2A' : '#4A6278' }" />
          <div v-if="idx < logs.length - 1" class="timeline-line flex-grow-1" />
        </div>

        <!-- Event card -->
        <div class="flex-grow-1 pb-4">
          <div class="d-flex align-start justify-space-between gap-2">
            <div>
              <div class="d-flex align-center ga-2 flex-wrap">
                <span class="font-weight-semibold text-body-2">{{ log.event_type_name }}</span>
                <v-chip
                  v-if="log.is_warranty_claim"
                  color="error" size="x-small" variant="tonal"
                  prepend-icon="mdi-shield-alert-outline"
                >เคลมประกัน</v-chip>
              </div>
              <div class="text-caption text-medium-emphasis mt-0.5">
                {{ fmtDate(log.event_date) }} · {{ log.performed_by }}
              </div>
            </div>
            <v-btn
              icon="mdi-delete-outline"
              size="x-small"
              variant="text"
              color="error"
              @click="$emit('delete', log.maintenance_id)"
            />
          </div>

          <div class="text-body-2 mt-1 pa-3 rounded-lg" style="background:rgba(0,0,0,0.04)">
            {{ log.description }}
          </div>

          <div v-if="log.next_service_date" class="d-flex align-center ga-1 mt-2 text-caption">
            <v-icon icon="mdi-calendar-clock-outline" size="14" color="primary" />
            <span>นัดครั้งต่อไป: <strong>{{ fmtDate(log.next_service_date) }}</strong></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
