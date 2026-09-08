<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { authApi } from "@/api/auth";
import { useUiStore } from "@/stores/ui";

const router = useRouter();
const ui = useUiStore();

const email = ref("");
const method = ref<"email" | "sms">("email");
const loading = ref(false);
const sent = ref(false);

const requiredField = (msg: string) => (v: string) => !!v || msg;
const validEmail = (msg: string) => (v: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || msg;

async function handleSendCode() {
  if (!email.value) return;
  loading.value = true;
  try {
    await authApi.forgotPassword(email.value, method.value);
    sent.value = true;
    ui.notify("ส่งรหัสยืนยันเรียบร้อยแล้ว", "success");
    router.push({
      name: "reset-password",
      query: { email: email.value, method: method.value },
    });
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
            <v-icon icon="mdi-lock-reset" color="primary" size="48" class="mb-2" />
            <div class="text-h5 font-weight-bold">ลืมรหัสผ่าน</div>
            <div class="text-body-2 text-medium-emphasis">
              เลือกวิธีรับรหัสยืนยันเพื่อเปลี่ยนรหัสผ่าน
            </div>
          </v-card-title>

          <v-card-text class="pt-4">
            <v-form @submit.prevent="handleSendCode">
              <v-text-field
                v-model="email"
                label="อีเมลที่ลงทะเบียนไว้"
                type="email"
                prepend-inner-icon="mdi-email-outline"
                variant="outlined"
                density="comfortable"
                :rules="[requiredField('กรุณากรอกอีเมล'), validEmail('รูปแบบอีเมลไม่ถูกต้อง')]"
                class="mb-4"
              />

              <div class="text-body-2 text-medium-emphasis mb-2">วิธีรับรหัสยืนยัน</div>
              <v-radio-group v-model="method" class="mt-0 mb-4">
                <v-radio label="ส่งทางอีเมล" value="email" color="primary" />
                <v-radio label="ส่งทาง SMS (เบอร์ที่ลงทะเบียน)" value="sms" color="primary" />
              </v-radio-group>

              <v-btn
                type="submit"
                color="primary"
                size="large"
                block
                :loading="loading"
                rounded="lg"
              >
                ส่งรหัสยืนยัน
              </v-btn>
            </v-form>
          </v-card-text>

          <v-card-actions class="justify-center pb-4">
            <v-btn variant="text" color="primary" size="small" to="/login">
              <v-icon start icon="mdi-arrow-left" />
              กลับไปเข้าสู่ระบบ
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
