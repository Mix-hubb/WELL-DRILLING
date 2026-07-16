<script setup lang="ts">
/**
 * WarrantyBadge — แสดงสถานะประกัน 2 ปี
 * alert_tier: ACTIVE | EXPIRING_SOON | EXPIRED
 * remaining_days: จำนวนวัน (ลบ = เกินแล้ว)
 */
defineProps<{
  alertTier: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";
  remainingDays: number;
  expiryDate: string;
  small?: boolean;
}>();

function tierColor(tier: string) {
  if (tier === "ACTIVE")        return "success";
  if (tier === "EXPIRING_SOON") return "warning";
  return "error";
}
function tierIcon(tier: string) {
  if (tier === "ACTIVE")        return "mdi-shield-check-outline";
  if (tier === "EXPIRING_SOON") return "mdi-shield-alert-outline";
  return "mdi-shield-off-outline";
}
function tierLabel(tier: string, days: number) {
  if (tier === "ACTIVE")        return `ในประกัน · เหลือ ${days} วัน`;
  if (tier === "EXPIRING_SOON") return `ใกล้หมดประกัน · เหลือ ${days} วัน`;
  return `หมดประกันแล้ว · ${Math.abs(days)} วัน`;
}
</script>

<template>
  <v-chip
    :color="tierColor(alertTier)"
    :prepend-icon="tierIcon(alertTier)"
    :size="small ? 'x-small' : 'small'"
    variant="tonal"
    label
  >
    {{ tierLabel(alertTier, remainingDays) }}
  </v-chip>
</template>
