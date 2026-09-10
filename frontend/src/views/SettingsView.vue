<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
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

const liffDrillChecking = ref(false);
const liffRepairChecking = ref(false);
const liffDrillStatus = ref<"ok" | "duplicate" | null>(null);
const liffRepairStatus = ref<"ok" | "duplicate" | null>(null);
const liffDrillUsedBy = ref("");
const liffRepairUsedBy = ref("");

const webhookUrl = computed(() => `${window.location.origin}/api/webhooks/line`);
const drillUrl = computed(() => liffIdDrilling.value ? `https://liff.line.me/${liffIdDrilling.value}/request-drill` : "");
const repairUrl = computed(() => liffIdRepair.value ? `https://liff.line.me/${liffIdRepair.value}/repair-form` : "");
const drillEndpoint = computed(() => liffIdDrilling.value ? `https://well-drilling.vercel.app/request-drill?liffId=${liffIdDrilling.value}` : "");
const repairEndpoint = computed(() => liffIdRepair.value ? `https://well-drilling.vercel.app/repair-form?liffId=${liffIdRepair.value}` : "");

const hasLineConfig = computed(() => !!channelId.value);

let checkDrillTimer: ReturnType<typeof setTimeout> | null = null;
let checkRepairTimer: ReturnType<typeof setTimeout> | null = null;

async function checkLiffId(liffId: string, type: "drill" | "repair") {
  if (!liffId || liffId.length < 5) {
    if (type === "drill") { liffDrillStatus.value = null; liffDrillUsedBy.value = ""; }
    else { liffRepairStatus.value = null; liffRepairUsedBy.value = ""; }
    return;
  }
  if (type === "drill") liffDrillChecking.value = true;
  else liffRepairChecking.value = true;

  try {
    const res = await api.get<{ available: boolean; used_by?: { org_id: string; org_name: string } }>(
      `/line-settings/check-liff?liff_id=${encodeURIComponent(liffId)}`
    );
    if (type === "drill") {
      liffDrillStatus.value = res.available ? "ok" : "duplicate";
      liffDrillUsedBy.value = res.used_by?.org_name || "";
    } else {
      liffRepairStatus.value = res.available ? "ok" : "duplicate";
      liffRepairUsedBy.value = res.used_by?.org_name || "";
    }
  } catch {
    if (type === "drill") { liffDrillStatus.value = null; }
    else { liffRepairStatus.value = null; }
  } finally {
    if (type === "drill") liffDrillChecking.value = false;
    else liffRepairChecking.value = false;
  }
}

watch(liffIdDrilling, (val) => {
  if (checkDrillTimer) clearTimeout(checkDrillTimer);
  checkDrillTimer = setTimeout(() => checkLiffId(val, "drill"), 400);
});

watch(liffIdRepair, (val) => {
  if (checkRepairTimer) clearTimeout(checkRepairTimer);
  checkRepairTimer = setTimeout(() => checkLiffId(val, "repair"), 400);
});

async function loadSettings() {
  try {
    const data = await api.get<LineSettings>("/line-settings");
    settings.value = data;
    channelId.value = data.line_channel_id || "";
    channelSecret.value = data.line_channel_secret || "";
    channelAccessToken.value = data.line_channel_access_token || "";
    liffIdDrilling.value = data.line_liff_id_drilling || "";
    liffIdRepair.value = data.line_liff_id_repair || "";

    if (data.line_liff_id_drilling) checkLiffId(data.line_liff_id_drilling, "drill");
    if (data.line_liff_id_repair) checkLiffId(data.line_liff_id_repair, "repair");
  } catch (err) {
    ui.notifyError(err);
  } finally {
    loading.value = false;
  }
}

onMounted(loadSettings);

const canSave = computed(() => {
  if (liffDrillStatus.value === "duplicate" || liffRepairStatus.value === "duplicate") return false;
  if (liffDrillChecking.value || liffRepairChecking.value) return false;
  return true;
});

const liffDrillHint = computed(() =>
  liffDrillStatus.value === "duplicate"
    ? "ถูกใช้โดย \"" + liffDrillUsedBy.value + "\" แล้ว!"
    : "LIFF App ที่ตั้ง Endpoint = /request-drill"
);

const liffRepairHint = computed(() =>
  liffRepairStatus.value === "duplicate"
    ? "ถูกใช้โดย \"" + liffRepairUsedBy.value + "\" แล้ว!"
    : "LIFF App ที่ตั้ง Endpoint = /repair-form"
);

const liffDrillColor = computed(() =>
  liffDrillStatus.value === "duplicate" ? "error" : liffDrillStatus.value === "ok" ? "success" : undefined
);

const liffRepairColor = computed(() =>
  liffRepairStatus.value === "duplicate" ? "error" : liffRepairStatus.value === "ok" ? "success" : undefined
);

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
      <v-col cols="12" md="8" lg="7">
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
              <div class="text-subtitle-1 font-weight-bold mb-1">
                <v-icon start icon="mdi-message-text-outline" size="18" />
                LINE Official Account
              </div>
              <div class="text-caption text-medium-emphasis mb-3">
                เชื่อมต่อ LINE OA ของคุณเข้ากับระบบ — <strong>1 LINE OA ต่อ 1 องค์กร</strong>
              </div>

              <v-alert type="info" variant="tonal" density="compact" class="mb-4">
                <div class="text-body-2">
                  <strong>ขั้นตอนการตั้งค่า (ทำครั้งเดียว):</strong>
                  <ol class="mt-1 mb-0 pl-4">
                    <li>ไปที่ <a href="https://developers.line.me" target="_blank" class="text-primary">LINE Developers Console</a></li>
                    <li><strong>ฝั่ง Messaging API channel:</strong> คัดลอก <strong>Channel ID</strong>, <strong>Channel Secret</strong>, <strong>Channel Access Token</strong> มาใส่ด้านล่าง</li>
                    <li><strong>ฝั่ง LINE Login channel:</strong> ไป tab <strong>LIFF</strong> → กด <strong>Add</strong> → สร้าง 2 LIFF Apps (แจ้งเจาะ + แจ้งซ่อม)</li>
                    <li>คัดลอก <strong>LIFF ID</strong> แต่ละตัวมาใส่ด้านล่าง</li>
                    <li>ตั้งค่า <strong>Endpoint URL</strong> ที่ระบบแสดงให้ (ตาม LIFF ID ที่กรอก)</li>
                    <li>Scope = <strong>profile</strong> + <strong>openid</strong>, Bot Prompt = <strong>Aggressive</strong></li>
                    <li>ไปตั้ง <strong>Webhook URL</strong> ที่ระบบแสดงให้ (ที่ Messaging API channel)</li>
                  </ol>
                </div>
              </v-alert>

              <!-- Channel ID -->
              <v-text-field
                v-model="channelId"
                label="Channel ID"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-identifier"
                hint="จาก LINE Developers Console → Basic settings"
                class="mb-2"
              />

              <!-- Channel Secret -->
              <v-text-field
                v-model="channelSecret"
                label="Channel Secret"
                :type="showSecret ? 'text' : 'password'"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-key-outline"
                :hint="settings.line_channel_secret ? 'ใส่ใหม่เฉพาะเมื่อต้องการเปลี่ยน' : 'จาก LINE Developers Console → Basic settings'"
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

              <!-- Channel Access Token -->
              <v-text-field
                v-model="channelAccessToken"
                label="Channel Access Token"
                :type="showToken ? 'text' : 'password'"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-key-variant"
                :hint="settings.line_channel_access_token ? 'ใส่ใหม่เฉพาะเมื่อต้องการเปลี่ยน' : 'จาก LINE Developers Console → Messaging API'"
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

              <!-- LIFF IDs -->
              <div class="text-subtitle-2 font-weight-bold mb-1">
                <v-icon start icon="mdi-link-variant" size="16" />
                LIFF App IDs (จาก LINE Login channel)
              </div>
              <div class="text-caption text-medium-emphasis mb-3">
                LIFF App สร้างในฝั่ง LINE Login channel → LIFF tab → Add
              </div>

              <!-- LIFF Drilling -->
              <v-text-field
                v-model="liffIdDrilling"
                label="LIFF ID (ฟอร์มแจ้งเจาะ)"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-file-document-outline"
                :hint="liffDrillHint"
                :color="liffDrillColor"
                :error="liffDrillStatus === 'duplicate'"
                :success="liffDrillStatus === 'ok' && !!liffIdDrilling"
                class="mb-1"
              >
                <template #append-inner>
                  <v-progress-circular v-if="liffDrillChecking" indeterminate size="18" width="2" color="primary" />
                  <v-icon v-else-if="liffDrillStatus === 'ok'" icon="mdi-check-circle" color="success" />
                  <v-icon v-else-if="liffDrillStatus === 'duplicate'" icon="mdi-alert-circle" color="error" />
                </template>
              </v-text-field>
              <v-alert v-if="liffDrillStatus === 'duplicate'" type="error" variant="tonal" density="compact" class="mb-3">
                LIFF ID นี้ถูกใช้โดย "<strong>{{ liffDrillUsedBy }}</strong>" แล้ว — 1 LIFF ID ใช้ได้กับ 1 องค์กรเท่านั้น
              </v-alert>

              <!-- LIFF Repair -->
              <v-text-field
                v-model="liffIdRepair"
                label="LIFF ID (ฟอร์มแจ้งซ่อม)"
                variant="outlined"
                density="compact"
                prepend-inner-icon="mdi-wrench-outline"
                :hint="liffRepairHint"
                :color="liffRepairColor"
                :error="liffRepairStatus === 'duplicate'"
                :success="liffRepairStatus === 'ok' && !!liffIdRepair"
                class="mb-1"
              >
                <template #append-inner>
                  <v-progress-circular v-if="liffRepairChecking" indeterminate size="18" width="2" color="primary" />
                  <v-icon v-else-if="liffRepairStatus === 'ok'" icon="mdi-check-circle" color="success" />
                  <v-icon v-else-if="liffRepairStatus === 'duplicate'" icon="mdi-alert-circle" color="error" />
                </template>
              </v-text-field>
              <v-alert v-if="liffRepairStatus === 'duplicate'" type="error" variant="tonal" density="compact" class="mb-3">
                LIFF ID นี้ถูกใช้โดย "<strong>{{ liffRepairUsedBy }}</strong>" แล้ว — 1 LIFF ID ใช้ได้กับ 1 องค์กรเท่านั้น
              </v-alert>
            </div>

            <v-divider v-if="hasLineConfig" />

            <!-- Generated URLs -->
            <template v-if="hasLineConfig">
              <div class="pa-4">
                <div class="text-subtitle-1 font-weight-bold mb-3">
                  <v-icon start icon="mdi-link" size="18" />
                  URLs ที่ต้องตั้งค่าใน LINE
                </div>

                <!-- Webhook URL -->
                <div class="mb-4">
                  <div class="d-flex align-center mb-1">
                    <v-icon icon="mdi-webhook" size="16" color="error" class="mr-1" />
                    <strong class="text-body-2">Webhook URL</strong>
                  </div>
                  <div class="text-caption text-medium-emphasis mb-1">ตั้งค่าที่ LINE Developers Console → Channel → Messaging API → Webhook URL</div>
                  <v-text-field
                    :model-value="webhookUrl"
                    variant="outlined"
                    density="compact"
                    readonly
                    hide-details
                  >
                    <template #append-inner>
                      <v-icon icon="mdi-content-copy" style="cursor: pointer" @click="copyToClipboard(webhookUrl, 'Webhook URL')" />
                    </template>
                  </v-text-field>
                </div>

                <!-- LIFF Endpoint URLs -->
                <div v-if="drillEndpoint || repairEndpoint" class="mb-4">
                  <div class="d-flex align-center mb-1">
                    <v-icon icon="mdi-cellphone-link" size="16" color="primary" class="mr-1" />
                    <strong class="text-body-2">Endpoint URLs (ตั้งค่าใน LIFF App)</strong>
                  </div>
                  <div class="text-caption text-medium-emphasis mb-2">ตั้งค่าที่ LINE Developers Console → LIFF tab → แก้ไข LIFF App → Endpoint URL</div>

                  <div v-if="drillEndpoint" class="mb-2">
                    <div class="text-caption font-weight-bold mb-1">
                      <v-icon icon="mdi-water-well" size="12" color="primary" class="mr-1" />
                      ฟอร์มแจ้งเจาะ
                    </div>
                    <v-text-field
                      :model-value="drillEndpoint"
                      variant="outlined"
                      density="compact"
                      readonly
                      hide-details
                    >
                      <template #append-inner>
                        <v-icon icon="mdi-content-copy" style="cursor: pointer" @click="copyToClipboard(drillEndpoint, 'Endpoint URL แจ้งเจาะ')" />
                      </template>
                    </v-text-field>
                  </div>

                  <div v-if="repairEndpoint">
                    <div class="text-caption font-weight-bold mb-1">
                      <v-icon icon="mdi-wrench-outline" size="12" color="warning" class="mr-1" />
                      ฟอร์มแจ้งซ่อม
                    </div>
                    <v-text-field
                      :model-value="repairEndpoint"
                      variant="outlined"
                      density="compact"
                      readonly
                      hide-details
                    >
                      <template #append-inner>
                        <v-icon icon="mdi-content-copy" style="cursor: pointer" @click="copyToClipboard(repairEndpoint, 'Endpoint URL แจ้งซ่อม')" />
                      </template>
                    </v-text-field>
                  </div>
                </div>

                <!-- Rich Menu URLs -->
                <div v-if="drillUrl || repairUrl" class="mb-4">
                  <div class="d-flex align-center mb-1">
                    <v-icon icon="mdi-menu" size="16" color="teal" class="mr-1" />
                    <strong class="text-body-2">Rich Menu URLs</strong>
                  </div>
                  <div class="text-caption text-medium-emphasis mb-2">คัดลอก URL ไปใส่ในปุ่ม Rich Menu บน LINE Official Account Manager</div>

                  <div v-if="drillUrl" class="mb-2">
                    <div class="text-caption font-weight-bold mb-1">
                      <v-icon icon="mdi-water-well" size="12" color="primary" class="mr-1" />
                      ปุ่มแจ้งเจาะบ่อ
                    </div>
                    <v-text-field
                      :model-value="drillUrl"
                      variant="outlined"
                      density="compact"
                      readonly
                      hide-details
                    >
                      <template #append-inner>
                        <v-icon icon="mdi-content-copy" style="cursor: pointer" @click="copyToClipboard(drillUrl, 'URL แจ้งเจาะ')" />
                      </template>
                    </v-text-field>
                  </div>

                  <div v-if="repairUrl">
                    <div class="text-caption font-weight-bold mb-1">
                      <v-icon icon="mdi-wrench-outline" size="12" color="warning" class="mr-1" />
                      ปุ่มแจ้งซ่อม
                    </div>
                    <v-text-field
                      :model-value="repairUrl"
                      variant="outlined"
                      density="compact"
                      readonly
                      hide-details
                    >
                      <template #append-inner>
                        <v-icon icon="mdi-content-copy" style="cursor: pointer" @click="copyToClipboard(repairUrl, 'URL แจ้งซ่อม')" />
                      </template>
                    </v-text-field>
                  </div>
                </div>

                <v-alert type="warning" variant="tonal" density="compact">
                  <div class="text-body-2">
                    <strong>วิธีตั้งค่า Rich Menu:</strong>
                    <ol class="mt-1 mb-0 pl-4">
                      <li>ไปที่ LINE Official Account Manager → Rich Menu</li>
                      <li>สร้าง/แก้ไขปุ่ม → เลือก <strong>Open URL</strong></li>
                      <li>คัดลอก URL ด้านบนไปใส่ในแต่ละปุ่ม</li>
                    </ol>
                  </div>
                </v-alert>
              </div>

              <v-divider />
            </template>

            <!-- Save Button -->
            <div class="pa-4">
              <v-btn
                color="primary"
                size="large"
                :loading="saving"
                :disabled="!canSave"
                @click="handleSave"
                rounded="lg"
              >
                <v-icon start icon="mdi-content-save" />
                บันทึกการตั้งค่า
              </v-btn>
              <div v-if="!canSave && (liffDrillStatus === 'duplicate' || liffRepairStatus === 'duplicate')" class="text-caption text-error mt-1">
                ไม่สามารถบันทึกได้ — มี LIFF ID ที่ซ้ำกับองค์กรอื่น
              </div>
            </div>
          </template>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
