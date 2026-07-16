<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useDisplay, useTheme } from "vuetify";
import { useRoute, useRouter } from "vue-router";
import { useUiStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import AppNavDrawer from "@/components/AppNavDrawer.vue";
import AppBottomNav from "@/components/AppBottomNav.vue";

const ui = useUiStore();
const auth = useAuthStore();
const theme = useTheme();
const { mobile } = useDisplay();
const route = useRoute();
const router = useRouter();

theme.global.name.value = ui.theme;

onMounted(() => {
  if (auth.token && !auth.user) {
    auth.fetchUser();
  }
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

      <v-app-bar flat :border="'b'" density="comfortable">
        <template v-if="mobile" #prepend>
          <v-icon icon="mdi-layers-triple" class="ml-2" color="primary" />
        </template>
        <v-app-bar-title class="font-display font-weight-bold">
          {{ mobile ? "ระบบจัดการบ่อบาดาล" : pageTitle }}
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

    <v-main>
      <v-container fluid :class="isAuthPage ? '' : 'pa-4 pa-md-6'" :style="isAuthPage ? 'background: rgb(var(--v-theme-background))' : ''">
        <router-view />
      </v-container>
    </v-main>

    <AppBottomNav v-if="!isAuthPage && mobile" />

    <v-snackbar v-model="ui.snackbar.show" :color="ui.snackbar.color" location="top" timeout="2600">
      {{ ui.snackbar.text }}
    </v-snackbar>
  </v-app>
</template>
