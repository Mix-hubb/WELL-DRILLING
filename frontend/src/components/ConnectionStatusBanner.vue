<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";
import { connected } from "@/composables/useSSE";

// Only show the banner once disconnected for a sustained period, so a brief
// normal reconnect blip doesn't flash a warning at the user.
const SHOW_AFTER_MS = 5000;

const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(
  connected,
  (isConnected) => {
    if (isConnected) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      visible.value = false;
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = null;
        visible.value = true;
      }, SHOW_AFTER_MS);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  if (timer) clearTimeout(timer);
});
</script>

<template>
  <v-slide-y-transition>
    <v-alert
      v-if="visible"
      type="warning"
      variant="tonal"
      density="compact"
      icon="mdi-wifi-off"
      class="connection-status-banner"
      rounded="0"
    >
      การเชื่อมต่อเรียลไทม์ขาดหาย กำลังลองเชื่อมต่อใหม่...
    </v-alert>
  </v-slide-y-transition>
</template>

<style scoped>
.connection-status-banner {
  margin: 0;
}
</style>
