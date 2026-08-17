<script setup lang="ts">
import { computed } from "vue";
import { useUiStore } from "@/stores/ui";

const props = defineProps<{ token: string | null; path: string }>();
const emit = defineEmits<{ regenerate: [] }>();
const ui = useUiStore();

const url = computed(() => (props.token ? `${window.location.origin}${props.path}${props.token}` : ""));

async function copy() {
  if (!url.value) return;
  try {
    await navigator.clipboard.writeText(url.value);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = url.value;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
  ui.notify("คัดลอกลิงก์ช่างแล้ว", "success");
}
</script>

<template>
  <div class="d-flex align-center ga-2" style="min-width:0">
    <v-icon icon="mdi-link-variant" size="16" color="primary" />
    <span class="text-caption text-medium-emphasis text-truncate" style="max-width:240px">
      <template v-if="token">{{ url }}</template>
      <template v-else>ยังไม่มีลิงก์ช่าง</template>
    </span>
    <v-btn v-if="token" size="x-small" variant="tonal" prepend-icon="mdi-content-copy" @click.stop="copy">
      copy
    </v-btn>
    <v-btn size="x-small" variant="tonal" prepend-icon="mdi-refresh" @click.stop="emit('regenerate')">
      {{ token ? "สร้างใหม่" : "สร้างลิงก์" }}
    </v-btn>
  </div>
</template>
