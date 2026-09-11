<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { authApi } from "@/api/auth";
import { useUiStore } from "@/stores/ui";
import { requiredField } from "@/utils/validation";

const router = useRouter();
const route = useRoute();
const ui = useUiStore();

const email = computed(() => (route.query.email as string) || "");
const method = computed(() => (route.query.method as string) || "email");

const code = ref("");
const newPassword = ref("");
const confirmPassword = ref("");
const loading = ref(false);
const verified = ref(false);
const showPassword = ref(false);

async function handleVerifyCode() {
  if (!code.value) return;
  loading.value = true;
  try {
    await authApi.verifyCode(email.value, code.value);
    verified.value = true;
    ui.notify("รหัสยืนยันถูกต้อง", "success");
  } catch (err) {
    ui.notifyError(err);
  } finally {
    loading.value = false;
  }
}

async function handleResetPassword() {
  if (!newPassword.value || !confirmPassword.value) return;
  if (newPassword.value.length < 6) {
    ui.notify("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร", "warning");
    return;
  }
  if (newPassword.value !== confirmPassword.value) {
    ui.notify("รหัสผ่านไม่ตรงกัน", "warning");
    return;
  }
  loading.value = true;
  try {
    await authApi.resetPassword(email.value, code.value, newPassword.value);
    ui.notify("เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่", "success");
    router.push("/login");
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
            <v-icon icon="mdi-shield-lock-outline" color="primary" size="48" class="mb-2" />
            <div class="text-h5 font-weight-bold">เปลี่ยนรหัสผ่าน</div>
            <div class="text-body-2 text-medium-emphasis">
              {{ method === "sms" ? "รหัสถูกส่งทาง SMS ไปที่เบอร์โทรศัพท์" : "รหัสถูกส่งไปที่อีเมล" }}: {{ email }}
            </div>
          </v-card-title>

          <v-card-text class="pt-4">
            <!-- Step 1: Enter code -->
            <v-form v-if="!verified" @submit.prevent="handleVerifyCode">
              <v-text-field
                v-model="code"
                label="รหัสยืนยัน 6 หลัก"
                prepend-inner-icon="mdi-key-outline"
                variant="outlined"
                density="comfortable"
                :rules="[requiredField('กรุณารหัสยืนยัน')]"
                class="mb-4"
                autocomplete="one-time-code"
                inputmode="numeric"
              />

              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                rounded="lg"
              >
                ยืนยันรหัส
              </v-btn>
            </v-form>

            <!-- Step 2: Enter new password -->
            <v-form v-else @submit.prevent="handleResetPassword">
              <v-alert type="success" variant="tonal" class="mb-4">
                ยืนยันรหัสสำเร็จ — กรอกรหัสผ่านใหม่
              </v-alert>

              <v-text-field
                v-model="newPassword"
                label="รหัสผ่านใหม่"
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
                variant="outlined"
                density="comfortable"
                hint="อย่างน้อย 6 ตัวอักษร"
                :rules="[requiredField('กรุณารหัสผ่านใหม่')]"
                class="mb-2"
                @click:append-inner="showPassword = !showPassword"
              />
              <v-text-field
                v-model="confirmPassword"
                label="ยืนยันรหัสผ่านใหม่"
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-check-outline"
                variant="outlined"
                density="comfortable"
                :rules="[requiredField('กรุณายืนยันรหัสผ่าน')]"
                class="mb-4"
              />

              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                rounded="lg"
              >
                เปลี่ยนรหัสผ่าน
              </v-btn>
            </v-form>
          </v-card-text>

          <v-card-actions class="justify-center pb-4">
            <v-btn variant="text" color="primary" size="small" to="/forgot-password">
              <v-icon start icon="mdi-arrow-left" />
              ขอรหัสใหม่
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
