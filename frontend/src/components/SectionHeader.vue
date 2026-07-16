<script setup lang="ts">
defineProps<{ title: string; icon: string }>();
defineEmits<{ add: [] }>();
</script>

<template>
  <div class="d-flex align-center justify-space-between mb-2 px-1">
    <div class="text-subtitle-1 font-display font-weight-bold d-flex align-center ga-2">
      <v-icon :icon="icon" size="20" />
      {{ title }}
    </div>
    <v-btn size="small" variant="tonal" color="primary" prepend-icon="mdi-plus" @click="$emit('add')">เพิ่ม</v-btn>
  </div>
</template>
