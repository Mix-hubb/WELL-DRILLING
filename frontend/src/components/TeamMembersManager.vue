<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { orgApi, type OrgInfo, type OrgMember } from "@/api/org";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { fmtDate } from "@/utils/date";

const auth = useAuthStore();
const ui = useUiStore();

const orgInfo = ref<OrgInfo | null>(null);
const members = ref<OrgMember[]>([]);
const loading = ref(true);

const deleteConfirmDialog = ref(false);
const memberToDelete = ref<OrgMember | null>(null);

const isAdmin = computed(() => auth.user?.role === "ADMIN");

async function load() {
  try {
    loading.value = true;
    const [info, memberList] = await Promise.all([
      orgApi.getInfo().catch(() => null),
      orgApi.getMembers(),
    ]);
    if (info) orgInfo.value = info;
    members.value = memberList;
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  load();
});

async function copyInviteCode() {
  const code = orgInfo.value?.invite_code || auth.user?.invite_code;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    ui.notify("คัดลอกรหัสเชิญแล้ว: " + code, "success");
  } catch {
    ui.notify("รหัสเชิญ: " + code, "info");
  }
}

async function rotateInviteCode() {
  if (!isAdmin.value) return;
  try {
    const result = await orgApi.rotateInviteCode();
    if (orgInfo.value) orgInfo.value.invite_code = result.invite_code;
    ui.notify("สร้างรหัสเชิญใหม่แล้ว รหัสเดิมใช้ไม่ได้อีกต่อไป", "success");
  } catch (e) {
    ui.notifyError(e);
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

        <div class="d-flex align-center ga-3">
          <div
            class="px-4 py-2 rounded font-weight-bold font-display"
            style="background: rgba(var(--v-theme-surface), 0.9); font-size: 1.25rem; letter-spacing: 2px; border: 1px dashed currentColor"
          >
            {{ orgInfo?.invite_code || auth.user?.invite_code || "—" }}
          </div>
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
            @click="rotateInviteCode"
          >
            สร้างรหัสใหม่
          </v-btn>
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
