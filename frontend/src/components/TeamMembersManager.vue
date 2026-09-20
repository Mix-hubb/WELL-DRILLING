<script setup lang="ts">
import { ref, computed } from "vue";
import { orgApi, type OrgInfo, type OrgMember } from "@/api/org";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { useSSERefresh } from "@/composables/useSSERefresh";
import { fmtDate } from "@/utils/date";
import { copyText } from "@/utils/clipboard";

const auth = useAuthStore();
const ui = useUiStore();

const orgInfo = ref<OrgInfo | null>(null);
const members = ref<OrgMember[]>([]);
const loading = ref(true);

const inviteCodeInput = ref("");
const codeDirty = ref(false);
const savingCode = ref(false);
const rotating = ref(false);

const deleteConfirmDialog = ref(false);
const memberToDelete = ref<OrgMember | null>(null);

const isAdmin = computed(() => auth.user?.role === "ADMIN");

const displayCode = computed(() =>
  (orgInfo.value?.invite_code || auth.user?.invite_code || "").toUpperCase()
);

async function load() {
  try {
    loading.value = true;
    const [info, memberList] = await Promise.all([
      orgApi.getInfo().catch(() => null),
      orgApi.getMembers(),
    ]);
    if (info) {
      orgInfo.value = info;
      inviteCodeInput.value = info.invite_code || auth.user?.invite_code || "";
      codeDirty.value = false;
    }
    members.value = memberList;
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
}

useSSERefresh(load, ["ORG_MEMBERS_CHANGED"]);

async function copyInviteCode() {
  const code = displayCode.value.trim();
  if (!code) {
    if (isAdmin.value) {
      await rotateInviteCode();
      return;
    }
    ui.notify("ยังไม่มีรหัสเชิญสำหรับองค์กรนี้", "warning");
    return;
  }
  const ok = await copyText(code);
  if (ok) {
    ui.notify("คัดลอกรหัสเชิญสำเร็จ: " + code, "success");
  } else {
    ui.notify("คัดลอกไม่สำเร็จ กรุณาลองใหม่", "error");
  }
}

async function rotateInviteCode() {
  if (!isAdmin.value) return;
  rotating.value = true;
  try {
    const result = await orgApi.rotateInviteCode();
    if (orgInfo.value) {
      orgInfo.value.invite_code = result.invite_code;
    } else {
      orgInfo.value = {
        org_id: "",
        name: auth.user?.org_name || "",
        slug: auth.user?.org_slug || "",
        invite_code: result.invite_code,
        created_at: "",
      };
    }
    if (auth.user) auth.user.invite_code = result.invite_code;
    inviteCodeInput.value = result.invite_code;
    codeDirty.value = false;
    ui.notify("สร้างรหัสเชิญใหม่แล้ว รหัสเดิมใช้ไม่ได้อีกต่อไป", "success");
  } catch (e) {
    ui.notifyError(e);
  } finally {
    rotating.value = false;
  }
}

async function saveInviteCode() {
  if (!isAdmin.value) return;
  const code = inviteCodeInput.value.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) {
    ui.notify("รหัสเชิญต้องเป็นตัวอักษร/ตัวเลข 4-16 หลัก ไม่มีเว้นวรรค", "warning");
    return;
  }
  savingCode.value = true;
  try {
    const result = await orgApi.updateInviteCode(code);
    if (orgInfo.value) orgInfo.value.invite_code = result.invite_code;
    if (auth.user) auth.user.invite_code = result.invite_code;
    inviteCodeInput.value = result.invite_code;
    codeDirty.value = false;
    ui.notify("บันทึกรหัสเชิญแล้ว: " + result.invite_code, "success");
  } catch (e) {
    ui.notifyError(e);
  } finally {
    savingCode.value = false;
  }
}

async function toggleRole(member: OrgMember) {
  if (!isAdmin.value) return;
  const newRole = member.role === "ADMIN" ? "DRILLER" : "ADMIN";
  try {
    await orgApi.updateRole(member.user_id, newRole);
    member.role = newRole;
    ui.notify(`เปลี่ยนบทบาทของ ${member.full_name} เป็น ${newRole === "ADMIN" ? "ผู้ดูแลระบบ" : "ช่างเจาะ"} แล้ว`, "success");
  } catch (e) {
    ui.notifyError(e);
  }
}

function confirmRemove(member: OrgMember) {
  memberToDelete.value = member;
  deleteConfirmDialog.value = true;
}

async function handleRemove() {
  if (!memberToDelete.value) return;
  try {
    await orgApi.removeMember(memberToDelete.value.user_id);
    ui.notify(`ลบ ${memberToDelete.value.full_name} ออกจากทีมแล้ว`, "success");
    deleteConfirmDialog.value = false;
    memberToDelete.value = null;
    await load();
  } catch (e) {
    ui.notifyError(e);
  }
}
</script>

<template>
  <div>
    <!-- Invite Code Banner Card -->
    <v-card variant="tonal" color="primary" class="pa-5 mb-5">
      <div class="d-flex flex-wrap align-center justify-space-between ga-4">
        <div>
          <div class="text-subtitle-1 font-display font-weight-bold d-flex align-center ga-2">
            <v-icon icon="mdi-domain" />
            {{ orgInfo?.name || auth.user?.org_name || "องค์กรของคุณ" }}
          </div>
          <div class="text-body-2 mt-1">
            นำรหัสเชิญนี้ให้ช่างเจาะหรือทีมงานของคุณกรอกตอนสมัครสมาชิก เพื่อเข้าร่วมทีมในองค์กรนี้
          </div>
        </div>

        <div class="d-flex flex-column ga-2 invite-code-panel" style="min-width: 260px">
          <v-text-field
            v-if="isAdmin"
            v-model="inviteCodeInput"
            label="Invite Code"
            hint="พิมพ์รหัสเชิญเองได้ ตัวอักษร/ตัวเลข 4-16 หลัก"
            persistent-hint
            variant="solo"
            density="compact"
            prepend-inner-icon="mdi-key-outline"
            :readonly="savingCode"
            @update:model-value="codeDirty = true"
          />
          <div
            v-else
            class="px-4 py-2 rounded font-weight-bold font-display"
            style="background: rgba(var(--v-theme-surface), 0.9); font-size: 1.25rem; letter-spacing: 2px; border: 1px dashed currentColor"
          >
            {{ displayCode || "—" }}
          </div>
          <div class="d-flex align-center ga-2 flex-wrap">
            <v-btn
              color="primary"
              variant="flat"
              prepend-icon="mdi-content-copy"
              @click="copyInviteCode"
            >
              คัดลอกรหัสเชิญ
            </v-btn>
            <v-btn
              v-if="isAdmin"
              color="warning"
              variant="tonal"
              prepend-icon="mdi-refresh"
              :loading="rotating"
              @click="rotateInviteCode"
            >
              สร้างรหัสใหม่
            </v-btn>
            <v-btn
              v-if="isAdmin"
              color="success"
              variant="flat"
              prepend-icon="mdi-content-save"
              :disabled="!codeDirty || savingCode"
              :loading="savingCode"
              @click="saveInviteCode"
            >
              บันทึก
            </v-btn>
          </div>
        </div>
      </div>
    </v-card>

    <!-- Team Members Header -->
    <div class="d-flex align-center justify-space-between mb-3">
      <div class="text-subtitle-1 font-display font-weight-bold">
        สมาชิกในทีมทั้งหมด ({{ members.length }})
      </div>
      <v-btn
        size="small"
        variant="text"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="load"
      >
        รีเฟรช
      </v-btn>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-8 text-medium-emphasis">
      <v-progress-circular indeterminate color="primary" class="mb-2" /><br />
      กำลังโหลดรายชื่อสมาชิกในทีม...
    </div>

    <!-- Members List -->
    <div v-else class="d-flex flex-column ga-3">
      <v-card
        v-for="m in members"
        :key="m.user_id"
        variant="outlined"
        class="pa-4"
      >
        <div class="d-flex align-center justify-space-between flex-wrap ga-3">
          <div class="d-flex align-center ga-3">
            <v-avatar color="primary" variant="tonal" size="44">
              <v-icon icon="mdi-account" />
            </v-avatar>
            <div>
              <div class="d-flex align-center ga-2">
                <span class="text-subtitle-1 font-weight-bold">{{ m.full_name }}</span>
                <v-chip
                  size="x-small"
                  :color="m.role === 'ADMIN' ? 'primary' : 'teal-darken-2'"
                  variant="flat"
                >
                  {{ m.role === "ADMIN" ? "ผู้ดูแลระบบ (ADMIN)" : "ช่างเจาะ (DRILLER)" }}
                </v-chip>
                <span v-if="String(m.user_id) === String(auth.user?.user_id)" class="text-caption text-medium-emphasis">
                  (คุณ)
                </span>
              </div>
              <div class="text-caption text-medium-emphasis mt-1 d-flex flex-wrap ga-3">
                <span><v-icon icon="mdi-email-outline" size="14" /> {{ m.email }}</span>
                <span v-if="m.phone"><v-icon icon="mdi-phone-outline" size="14" /> {{ m.phone }}</span>
                <span><v-icon icon="mdi-clock-outline" size="14" /> เข้าร่วมเมื่อ {{ fmtDate(m.created_at) }}</span>
              </div>
            </div>
          </div>

          <!-- Actions (Only for Admin & not self) -->
          <div v-if="isAdmin && String(m.user_id) !== String(auth.user?.user_id)" class="d-flex align-center ga-2">
            <v-btn
              size="small"
              variant="tonal"
              :color="m.role === 'ADMIN' ? 'warning' : 'primary'"
              @click="toggleRole(m)"
            >
              {{ m.role === "ADMIN" ? "ปรับเป็น ช่างเจาะ" : "แต่งตั้งเป็น ผู้ดูแล" }}
            </v-btn>
            <v-btn
              icon="mdi-account-remove-outline"
              size="small"
              variant="text"
              color="error"
              title="ลบออกจากทีม"
              @click="confirmRemove(m)"
            />
          </div>
        </div>
      </v-card>
    </div>

    <!-- Remove Member Confirm Dialog -->
    <v-dialog v-model="deleteConfirmDialog" max-width="420">
      <v-card>
        <v-card-title class="pa-4 font-display font-weight-bold text-error">
          ยืนยันการลบสมาชิกออกจากทีม
        </v-card-title>
        <v-card-text class="pa-4">
          คุณต้องการลบ <strong>{{ memberToDelete?.full_name }}</strong> ออกจากองค์กรหรือไม่?
        </v-card-text>
        <v-card-actions class="pa-4 ga-2">
          <v-spacer />
          <v-btn variant="text" @click="deleteConfirmDialog = false">ยกเลิก</v-btn>
          <v-btn color="error" variant="flat" @click="handleRemove">ลบออกจากทีม</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
@media (max-width: 600px) {
  .invite-code-panel {
    flex-basis: 100%;
    min-width: 0;
    width: 100%;
  }
}
</style>
