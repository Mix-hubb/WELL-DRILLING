<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";

const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

const email = ref("");
const password = ref("");
const loading = ref(false);
const showPassword = ref(false);

async function handleLogin() {
  if (!email.value || !password.value) {
    ui.notify("กรุณากรอกอีเมลและรหัสผ่าน", "warning");
    return;
  }
  loading.value = true;
  try {
    await auth.login(email.value, password.value);
    ui.notify("เข้าสู่ระบบสำเร็จ", "success");
    router.push("/dashboard");
  } catch (err) {
    ui.notifyError(err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <v-container class="fill-height" fluid>
    <v-row justify="center">
      <v-col cols="12" sm="8" md="5" lg="4">
        <v-card class="pa-4" rounded="xl" elevation="8">
          <v-card-title class="text-center pb-2">
            <v-icon icon="mdi-layers-triple" color="primary" size="48" class="mb-2" />
            <div class="text-h5 font-weight-bold">ระบบจัดการบ่อบาดาล</div>
            <div class="text-body-2 text-medium-emphasis">DGWM Well Drilling</div>
          </v-card-title>

          <v-card-text class="pt-4">
            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="email"
                label="อีเมล"
                type="email"
                prepend-inner-icon="mdi-email-outline"
                variant="outlined"
                density="comfortable"
                :rules="[v => !!v || 'กรุณากรอกอีเมล']"
                class="mb-2"
              />
              <v-text-field
                v-model="password"
                label="รหัสผ่าน"
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                variant="outlined"
                density="comfortable"
                :rules="[v => !!v || 'กรุณากรอกรหัสผ่าน']"
                class="mb-4"
                @click:append-inner="showPassword = !showPassword"
              />
              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                rounded="lg"
              >
                เข้าสู่ระบบ
              </v-btn>
            </v-form>
          </v-card-text>

          <v-card-actions class="justify-center">
            <span class="text-body-2 text-medium-emphasis">ยังไม่มีบัญชี?</span>
            <v-btn variant="text" color="primary" size="small" to="/register">
              ลงทะเบียน
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
