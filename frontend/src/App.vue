<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { connectSSE, disconnectSSE, ensureConnected } from "@/composables/useSSE";
import { useDisplay, useTheme } from "vuetify";
import { useRoute, useRouter } from "vue-router";
import { useUiStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import AppNavDrawer from "@/components/AppNavDrawer.vue";
import AppBottomNav from "@/components/AppBottomNav.vue";
import ConnectionStatusBanner from "@/components/ConnectionStatusBanner.vue";

const ui = useUiStore();
const auth = useAuthStore();
const theme = useTheme();
const { mobile } = useDisplay();
const route = useRoute();
const router = useRouter();

theme.global.name.value = ui.theme;

watch(
  () => auth.token,
  (token) => {
    if (token) connectSSE();
    else disconnectSSE();
  },
  { immediate: true },
);

onMounted(async () => {
  if (auth.token && !auth.user && !route.meta.public) {
    try {
      await auth.fetchUser();
    } catch {
      // token expired on protected route — redirect to login via router
      if (!route.meta.public) {
        router.push("/login");
      }
    }
  }

  // The realtime websocket can die silently while the tab is backgrounded or
  // the network drops, with no CHANNEL_ERROR/CLOSED ever firing — re-verify
  // the connection whenever the tab becomes visible again or the browser
  // reports it's back online.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ensureConnected();
  });
  window.addEventListener("online", ensureConnected);
});

function toggleTheme() {
  ui.toggleTheme();
  theme.global.name.value = ui.theme;
}

function handleLogout() {
  auth.logout();
  router.push("/login");
}

const isAuthPage = computed(() => route.meta.public === true);
const pageTitle = computed(() => (route.meta.label as string) || "ระบบจัดการบ่อบาดาล");
</script>

<template>
  <v-app>
    <template v-if="!isAuthPage">
      <AppNavDrawer v-if="!mobile" />

      <v-app-bar flat :border="'b'" density="comfortable" class="app-topbar">
        <template v-if="mobile" #prepend>
          <v-avatar rounded="lg" size="32" class="brand-tile ml-2">
            <v-icon icon="mdi-layers-triple" size="18" />
          </v-avatar>
        </template>
        <v-app-bar-title class="font-display font-weight-bold text-truncate">
          {{ pageTitle }}
        </v-app-bar-title>
        <v-spacer />
        <template v-if="auth.isLoggedIn">
          <v-chip size="small" variant="tonal" color="primary" class="mr-2 d-none d-sm-flex">
            <v-icon start icon="mdi-account-circle-outline" />
            {{ auth.fullName }}
          </v-chip>
          <v-btn icon="mdi-logout" variant="text" size="small" @click="handleLogout" />
        </template>
        <v-btn :icon="ui.theme === 'lightTheme' ? 'mdi-weather-night' : 'mdi-white-balance-sunny'" variant="text" @click="toggleTheme" />
      </v-app-bar>
    </template>

    <ConnectionStatusBanner v-if="auth.isLoggedIn" />

    <v-main>
      <v-container fluid :class="isAuthPage ? '' : 'pa-4 pa-md-6 page-container'" :style="isAuthPage ? 'background: transparent' : ''">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" :key="route.path" />
          </transition>
        </router-view>
      </v-container>
    </v-main>

    <AppBottomNav v-if="!isAuthPage && mobile" />

    <!-- Bottom safe-area spacer on mobile -->
    <div v-if="!isAuthPage && mobile" class="d-sm-none" style="height:var(--safe-bottom)" />

    <v-snackbar v-model="ui.snackbar.show" :color="ui.snackbar.color" location="top" timeout="2600">
      {{ ui.snackbar.text }}
    </v-snackbar>
  </v-app>
</template>
