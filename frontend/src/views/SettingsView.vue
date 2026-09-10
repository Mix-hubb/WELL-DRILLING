<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { api } from "@/api/client";

const auth = useAuthStore();
const ui = useUiStore();

interface LineSettings {
  org_id: string;
  name: string;
  slug: string;
  invite_code: string;
  line_channel_id: string | null;
  line_channel_secret: string | null;
  line_channel_access_token: string | null;
  line_liff_id_drilling: string | null;
  line_liff_id_repair: string | null;
}

const settings = ref<LineSettings | null>(null);
const loading = ref(true);
const saving = ref(false);
const showSecret = ref(false);
const showToken = ref(false);

const channelId = ref("");
const channelSecret = ref("");
const channelAccessToken = ref("");
const liffIdDrilling = ref("");
const liffIdRepair = ref("");

const webhookUrl = "https://well-drilling-api.onrender.com/api/webhooks/line";
const drillUrl = computed(() => liffIdDrilling.value ? `https://liff.line.me/${liffIdDrilling.value}/request-drill` : "");
const repairUrl = computed(() => liffIdRepair.value ? `https://liff.line.me/${liffIdRepair.value}/repair-form` : "");

async function loadSettings() {
  try {
    const data = await api.get<LineSettings>("/line-settings");
    settings.value = data;
    channelId.value = data.line_channel_id || "";
    channelSecret.value = data.line_channel_secret || "";
    channelAccessToken.value = data.line_channel_access_token || "";
    liffIdDrilling.value = data.line_liff_id_drilling || "";
    liffIdRepair.value = data.line_liff_id_repair || "";
  } catch (err) {
    ui.notifyError(err);
  } finally {
    loading.value = false;
  }
}

onMounted(loadSettings);

async function handleSave() {
  saving.value = true;
  try {
    await api.put("/line-settings", {
      line_channel_id: channelId.value,
      line_channel_secret: channelSecret.value,
      line_channel_access_token: channelAccessToken.value,
      line_liff_id_drilling: liffIdDrilling.value,
      line_liff_id_repair: liffIdRepair.value,
    });
    channelSecret.value = "";
    channelAccessToken.value = "";
    showSecret.value = false;
    showToken.value = false;
    await loadSettings();
    ui.notify("บันทึกสำเร็จ", "success");
  } catch (err) {
    ui.notifyError(err);
  } finally {
    saving.value = false;
  }
}

function copyInviteCode() {
  if (settings.value?.invite_code) {
    navigator.clipboard.writeText(settings.value.invite_code);
    ui.notify("คัดลอก Invite Code แล้ว", "success");
  }
}

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text);
  ui.notify(`คัดลอก ${label} แล้ว`, "success");
}
</script>

<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12" md="8" lg="6">
        <v-card rounded="xl" elevation="1">
          <v-card-title class="text-h6 font-weight-bold pa-4 pb-2">
            <v-icon start icon="mdi-cog-outline" color="primary" />
            ตั้งค่าระบบ
          </v-card-title>

          <v-card-text v-if="loading" class="text-center pa-8">
            <v-progress-circular indeterminate color="primary" />
            <div class="mt-2 text-medium-emphasis">กำลังโหลด...</div>
          </v-card-text>

          <template v-else-if="settings">
            <v-divider />

            <!-- Organization Info -->
            <div class="pa-4">
              <div class="text-subtitle-1 font-weight-bold mb-3">
                <v-icon start icon="mdi-office-building-outline" size="18" />
                ข้อมูลองค์กร
              </div>
              <v-text-field
                :model-value="settings.name"
                label="ชื่อองค์กร"
                variant="outlined"
                density="compact"
                readonly
                prepend-inner-icon="mdi-domain"
                class="mb-2"
              />
              <div class="d-flex align-center gap-2 mb-2">
                <v-text-field
                  :model-value="settings.invite_code"
                  label="Invite Code"
                  variant="outlined"
                  density="compact"
                  readonly
                  prepend-inner-icon="mdi-key-outline"
                  class="flex-grow-1"
                />
                <v-btn icon="mdi-content-copy" variant="tonal" size="small" @click="copyInviteCode" />
              </div>
              <v-alert type="info" variant="tonal" density="compact" class="mb-0">
                แชร์ Invite Code นี้ให้ทีมงานเพื่อลงทะเบียนเข้าร่วมองค์กร
              </v-alert>
            </div>

            <v-divider />

            <!-- LINE OA Config -->
            <div class="pa-4">
              <div class="text-subtitle-1 font-weight-bold mb-3">
                <v-icon start icon="mdi-message-text-outline" size="18" />
                LINE Official Account
              </div>

              <v-text-field
                v-model="channelId"
                label="Channel ID"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-identifier"
                hint="จาก LINE Developers Console"
                class="mb-2"
              />
              <v-text-field
                v-model="channelSecret"
                label="Channel Secret"
                :type="showSecret ? 'text' : 'password'"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-key-outline"
                :hint="settings.line_channel_secret ? 'ใส่ใหม่เฉพาะเมื่อต้องการเปลี่ยน' : 'จาก LINE Developers Console'"
                class="mb-2"
              >
                <template #append-inner>
                  <v-icon
                    :icon="showSecret ? 'mdi-eye-off' : 'mdi-eye'"
                    @click="showSecret = !showSecret"
                    style="cursor: pointer"
                  />
                </template>
              </v-text-field>
              <v-text-field
                v-model="channelAccessToken"
                label="Channel Access Token"
                :type="showToken ? 'text' : 'password'"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-key-variant"
                :hint="settings.line_channel_access_token ? 'ใส่ใหม่เฉพาะเมื่อต้องการเปลี่ยน' : 'จาก LINE Developers Console'"
                class="mb-2"
              >
                <template #append-inner>
                  <v-icon
                    :icon="showToken ? 'mdi-eye-off' : 'mdi-eye'"
                    @click="showToken = !showToken"
                    style="cursor: pointer"
                  />
                </template>
              </v-text-field>

              <v-divider class="my-3" />

              <div class="text-subtitle-2 font-weight-bold mb-2">
                <v-icon start icon="mdi-link-variant" size="16" />
                LIFF App IDs
              </div>

              <v-text-field
                v-model="liffIdDrilling"
                label="LIFF ID (ฟอร์มแจ้งเจาะ)"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-file-document-outline"
                hint="เช่น 2011186152-tM5o2rXR"
                class="mb-2"
              />
              <v-text-field
                v-model="liffIdRepair"
                label="LIFF ID (ฟอร์มแจ้งซ่อม)"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-wrench-outline"
                hint="เช่น 2011186152-nmGN0upm"
                class="mb-2"
              />

              <v-alert type="info" variant="tonal" density="compact" class="mt-2">
                <div class="text-body-2">
                  <strong>ขั้นตอนการตั้งค่า:</strong>
                  <ol class="mt-1">
                    <li>สร้าง LINE Official Account ใน LINE OA Manager</li>
                    <li>เปิดใช้ Messaging API</li>
                    <li>สร้าง LIFF App ใน LINE Developers Console</li>
                    <li>กรอกค่าด้านบนในระบบ</li>
                    <li>ตั้ง Webhook URL เป็น: <code>{{ webhookUrl }}</code></li>
                  </ol>
                </div>
              </v-alert>
            </div>

            <v-divider />

            <!-- Rich Menu URLs -->
            <div class="pa-4" v-if="drillUrl || repairUrl">
              <div class="text-subtitle-1 font-weight-bold mb-3">
                <v-icon start icon="mdi-link" size="18" />
                URL สำหรับ Rich Menu
              </div>
              <div class="text-body-2 text-medium-emphasis mb-3">
                คัดลอก URL ด้านล่างไปใส่ในปุ่ม Rich Menu บน LINE Official Account Manager
              </div>

              <div v-if="drillUrl" class="mb-3">
                <div class="text-caption font-weight-bold mb-1">ปุ่มแจ้งเจาะบ่อ</div>
                <v-text-field
                  :model-value="drillUrl"
                  variant="outlined"
                  density="compact"
                  readonly
                  prepend-inner-icon="mdi-water-well"
                >
                  <template #append-inner>
                    <v-icon
                      icon="mdi-content-copy"
                      style="cursor: pointer"
                      @click="copyToClipboard(drillUrl, 'URL แจ้งเจาะ')"
                    />
                  </template>
                </v-text-field>
              </div>

              <div v-if="repairUrl" class="mb-3">
                <div class="text-caption font-weight-bold mb-1">ปุ่มแจ้งซ่อม</div>
                <v-text-field
                  :model-value="repairUrl"
                  variant="outlined"
                  density="compact"
                  readonly
                  prepend-inner-icon="mdi-wrench-outline"
                >
                  <template #append-inner>
                    <v-icon
                      icon="mdi-content-copy"
                      style="cursor: pointer"
                      @click="copyToClipboard(repairUrl, 'URL แจ้งซ่อม')"
                    />
                  </template>
                </v-text-field>
              </div>

              <v-alert type="warning" variant="tonal" density="compact" class="mt-2">
                <div class="text-body-2">
                  <strong>วิธีตั้งค่า Rich Menu:</strong>
                  <ol class="mt-1">
                    <li>ไปที่ LINE Official Account Manager → Rich Menu</li>
                    <li>สร้าง/แก้ไขปุ่ม → เลือก <strong>Open URL</strong></li>
                    <li>คัดลอก URL ด้านบนไปใส่ในแต่ละปุ่ม</li>
                  </ol>
                </div>
              </v-alert>
            </div>

            <v-divider v-if="drillUrl || repairUrl" />

            <div class="pa-4">
              <v-btn
                color="primary"
                size="large"
                :loading="saving"
                @click="handleSave"
                rounded="lg"
              >
                <v-icon start icon="mdi-content-save" />
                บันทึกการตั้งค่า
              </v-btn>
            </div>
          </template>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
