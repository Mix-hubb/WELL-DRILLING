<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { requiredField, validEmail, validPhone } from "@/utils/validation";

const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

const mode = ref<"new" | "join">("new");
const fullName = ref("");
const email = ref("");
const phone = ref("");
const password = ref("");
const confirmPassword = ref("");
const orgName = ref("");
const inviteCode = ref("");
const loading = ref(false);
const showPassword = ref(false);

async function handleRegister() {
  if (!fullName.value || !email.value || !phone.value || !password.value) {
    ui.notify("กรุณากรอกข้อมูลให้ครบทุกช่อง", "warning");
    return;
  }
  if (password.value.length < 6) {
    ui.notify("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร", "warning");
    return;
  }
  if (password.value !== confirmPassword.value) {
    ui.notify("รหัสผ่านไม่ตรงกัน", "warning");
    return;
  }
  if (mode.value === "new" && !orgName.value) {
    ui.notify("กรุณากรอกชื่อบริษัท/องค์กร", "warning");
    return;
  }
  if (mode.value === "join" && !inviteCode.value) {
    ui.notify("กรุณากรอก Invite Code", "warning");
    return;
  }

  loading.value = true;
  try {
    const opts = mode.value === "new"
      ? { org_name: orgName.value }
      : { invite_code: inviteCode.value };
    await auth.register(email.value, password.value, fullName.value, phone.value, opts);
    ui.notify("ลงทะเบียนสำเร็จ", "success");
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
            <v-icon icon="mdi-account-plus-outline" color="primary" size="48" class="mb-2" />
            <div class="text-h5 font-weight-bold">ลงทะเบียนผู้ใช้ใหม่</div>
            <div class="text-body-2 text-medium-emphasis">สร้างบัญชีสำหรับเข้าใช้งานระบบ</div>
          </v-card-title>

          <v-card-text class="pt-4">
            <v-btn-toggle v-model="mode" mandatory color="primary" variant="outlined" divided class="mb-4" density="compact">
              <v-btn value="new" size="small" class="flex-grow-1">
                <v-icon start>mdi-office-building-outline</v-icon>
                สร้างบริษัทใหม่
              </v-btn>
              <v-btn value="join" size="small" class="flex-grow-1">
                <v-icon start>mdi-key-outline</v-icon>
                เข้าร่วมบริษัท
              </v-btn>
            </v-btn-toggle>

            <v-form @submit.prevent="handleRegister">
              <v-text-field
                v-if="mode === 'new'"
                v-model="orgName"
                label="ชื่อบริษัท / องค์กร"
                prepend-inner-icon="mdi-office-building-outline"
                variant="outlined"
                density="comfortable"
                class="mb-2"
              />
              <v-text-field
                v-if="mode === 'join'"
                v-model="inviteCode"
                label="Invite Code"
                prepend-inner-icon="mdi-key-outline"
                variant="outlined"
                density="comfortable"
                hint="ขอ Invite Code จากผู้ดูแลระบบ"
                class="mb-2"
              />
              <v-text-field
                v-model="fullName"
                label="ชื่อ-นามสกุล"
                prepend-inner-icon="mdi-account-outline"
                variant="outlined"
                density="comfortable"
                class="mb-2"
              />
              <v-text-field
                v-model="email"
                label="อีเมล"
                type="email"
                prepend-inner-icon="mdi-email-outline"
                variant="outlined"
                density="comfortable"
                :rules="[requiredField('กรุณากรอกอีเมล'), validEmail('รูปแบบอีเมลไม่ถูกต้อง')]"
                class="mb-2"
              />
              <v-text-field
                v-model="phone"
                label="เบอร์โทรศัพท์"
                type="tel"
                prepend-inner-icon="mdi-phone-outline"
                variant="outlined"
                density="comfortable"
                hint="สำหรับกู้คืนรหัสผ่าน"
                :rules="[requiredField('กรุณากรอกเบอร์โทรศัพท์'), validPhone('เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก')]"
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
                hint="อย่างน้อย 6 ตัวอักษร"
                class="mb-2"
                @click:append-inner="showPassword = !showPassword"
              />
              <v-text-field
                v-model="confirmPassword"
                label="ยืนยันรหัสผ่าน"
                :type="showPassword ? 'text' : 'password'"
                prepend-inner-icon="mdi-lock-check-outline"
                variant="outlined"
                density="comfortable"
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
                ลงทะเบียน
              </v-btn>
            </v-form>
          </v-card-text>

          <v-card-actions class="justify-center">
            <span class="text-body-2 text-medium-emphasis">มีบัญชีอยู่แล้ว?</span>
            <v-btn variant="text" color="primary" size="small" to="/login">
              เข้าสู่ระบบ
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
