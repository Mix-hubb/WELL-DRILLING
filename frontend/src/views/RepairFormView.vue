<script setup lang="ts">
import { ref } from "vue";
import { repairRequestsApi } from "@/api/repairRequests";
import { api } from "@/api/client";
import { useUiStore } from "@/stores/ui";

const ui = useUiStore();

const PROBLEMS = [
  { value: "ไม่มีน้ำ",           icon: "mdi-water-off-outline" },
  { value: "น้ำไหลอ่อน",        icon: "mdi-water-outline" },
  { value: "ปั๊มเสีย",           icon: "mdi-water-pump-off" },
  { value: "ตู้คอนโทรล/ไฟเสีย",  icon: "mdi-electronics-off" },
  { value: "ท่อ/บ่อทรุด",        icon: "mdi-collapse" },
  { value: "น้ำขุ่น/น้ำมีกลิ่น",  icon: "mdi-water-alert-outline" },
];

const form = ref({
  name:    "",
  phone:   "",
  address: "",
  well_name: "",
  problems: [] as string[],
  detail:  "",
});
const photos = ref<string[]>([]);
const uploading = ref(false);
const submitting = ref(false);
const done = ref(false);

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files?.length) return;
  uploading.value = true;
  try {
    for (const f of Array.from(input.files)) {
      const url = await api.upload(f, "form");
      photos.value.push(url);
    }
  } catch (err) {
    ui.notifyError(err);
  } finally {
    uploading.value = false;
    input.value = "";
  }
}

function removePhoto(i: number) { photos.value.splice(i, 1); }

async function submit() {
  if (!form.value.name || !form.value.phone || !form.value.problems.length) return;
  submitting.value = true;
  try {
    await repairRequestsApi.createPublic({
      name:    form.value.name,
      phone:   form.value.phone,
      address: form.value.address || null,
      well_name: form.value.well_name || null,
      problems: form.value.problems,
      detail:  form.value.detail || null,
      photos:  photos.value,
    });
    done.value = true;
  } catch (e) {
    ui.notifyError(e);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div style="max-width:560px;margin:0 auto">
    <v-card v-if="!done" class="pa-5">
      <div class="text-center mb-4">
        <v-icon icon="mdi-wrench-outline" color="primary" size="40" class="mb-2" />
        <div class="text-h6 font-display font-weight-bold">แจ้งซ่อมบ่อบาดาล</div>
        <div class="text-caption text-medium-emphasis">กรอกข้อมูลเพื่อให้ทีมงานติดต่อกลับ</div>
      </div>

      <v-text-field v-model="form.name" label="ชื่อ-นามสกุล *" class="mb-3" />
      <v-text-field v-model="form.phone" label="เบอร์โทรติดต่อ *" class="mb-3" />
      <v-text-field v-model="form.well_name" label="ชื่อ/ตำแหน่งบ่อ (ถ้ามี)" class="mb-3" />
      <v-textarea v-model="form.address" label="ที่อยู่" rows="2" class="mb-3" />

      <div class="text-subtitle-2 font-weight-bold mb-2">เลือกอาการที่พบ *</div>
      <div class="d-flex flex-column ga-2 mb-3">
        <v-checkbox
          v-for="p in PROBLEMS" :key="p.value"
          v-model="form.problems" :value="p.value" :label="p.value" hide-details
          density="compact"
        />
      </div>

      <v-textarea v-model="form.detail" label="รายละเอียดเพิ่มเติม" rows="3" class="mb-3" />

      <div class="text-subtitle-2 font-weight-bold mb-1">แนบรูปอาการเสีย</div>
      <div class="d-flex flex-wrap ga-2 mb-2">
        <div v-for="(p, i) in photos" :key="p" class="position-relative">
          <v-img :src="api.fileUrl(p)" width="72" height="72" cover rounded="6" />
          <v-btn
            icon="mdi-close" size="x-small" color="error" variant="flat"
            class="position-absolute" style="top:-8px;right:-8px"
            @click="removePhoto(i)"
          />
        </div>
        <label
          class="d-flex align-center justify-center"
          style="width:72px;height:72px;border:1px dashed rgba(0,0,0,0.3);border-radius:6px;cursor:pointer"
        >
          <v-icon v-if="!uploading" icon="mdi-camera-plus-outline" color="medium-emphasis" />
          <v-progress-circular v-else size="20" indeterminate color="primary" />
          <input type="file" accept="image/*" multiple hidden @change="onFiles" />
        </label>
      </div>

      <v-btn
        color="primary" size="large" block variant="flat" :loading="submitting"
        :disabled="!form.name || !form.phone || !form.problems.length"
        @click="submit"
      >ส่งคำร้องแจ้งซ่อม</v-btn>
    </v-card>

    <v-card v-else class="pa-6 text-center">
      <v-icon icon="mdi-check-circle-outline" color="success" size="48" class="mb-2" />
      <div class="text-h6 font-display font-weight-bold mb-1">ส่งคำร้องแล้ว</div>
      <div class="text-body-2 text-medium-emphasis">ทีมงานจะติดต่อกลับโดยเร็วที่สุด</div>
      <v-btn color="primary" variant="flat" class="mt-4" @click="done = false">แจ้งซ่อมอีกครั้ง</v-btn>
    </v-card>
  </div>
</template>
