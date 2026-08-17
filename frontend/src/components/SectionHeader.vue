<script setup lang="ts">
defineProps<{ title: string; icon: string }>();
defineEmits<{ add: [] }>();
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-3 px-1">
    <div class="d-flex align-center ga-2">
      <div class="section-head-icon">
        <v-icon :icon="icon" size="18" />
      </div>
      <div class="text-subtitle-1 font-display font-weight-bold">{{ title }}</div>
    </div>
    <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus" @click="$emit('add')">เพิ่ม</v-btn>
  </div>
</template>
