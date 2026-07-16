<script setup lang="ts">
import { computed } from "vue";
import { useDisplay, useTheme } from "vuetify";
import { useRoute } from "vue-router";
import { useUiStore } from "@/stores/ui";
import AppNavDrawer from "@/components/AppNavDrawer.vue";
import AppBottomNav from "@/components/AppBottomNav.vue";

const ui = useUiStore();
const theme = useTheme();
const { mobile } = useDisplay();
const route = useRoute();

theme.global.name.value = ui.theme;

function toggleTheme() {
  ui.toggleTheme();
  theme.global.name.value = ui.theme;
}

const pageTitle = computed(() => (route.meta.label as string) || "ระบบจัดการบ่อบาดาล");
</script>

<template>
  <v-app>
    <AppNavDrawer v-if="!mobile" />

    <v-app-bar flat :border="'b'" density="comfortable">
      <template v-if="mobile" #prepend>
        <v-icon icon="mdi-layers-triple" class="ml-2" color="primary" />
      </template>
      <v-app-bar-title class="font-display font-weight-bold">
        {{ mobile ? "ระบบจัดการบ่อบาดาล" : pageTitle }}
      </v-app-bar-title>
      <v-spacer />
      <v-btn :icon="ui.theme === 'lightTheme' ? 'mdi-weather-night' : 'mdi-white-balance-sunny'" variant="text" @click="toggleTheme" />
    </v-app-bar>

    <v-main>
      <v-container fluid class="pa-4 pa-md-6" :class="{ 'pb-16': mobile }">
        <router-view />
      </v-container>
    </v-main>

    <AppBottomNav v-if="mobile" />

    <v-snackbar v-model="ui.snackbar.show" :color="ui.snackbar.color" location="top" timeout="2600">
      {{ ui.snackbar.text }}
    </v-snackbar>
  </v-app>
</template>
