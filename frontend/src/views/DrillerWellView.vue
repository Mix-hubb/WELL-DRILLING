<script setup lang="ts">
import { useRoute } from "vue-router";
import { useDrillerWellForm } from "@/composables/useDrillerWellForm";
import PumpCatalogPicker from "@/components/PumpCatalogPicker.vue";

const route = useRoute();
const token = route.params.token as string;
const {
  job, loading, submitting, saved, form,
  methodOptions, waterOptions, hardnessOptions, lithologyOptions,
  materialOptions, pipeTypeOptions, protectionOptions, PIPE_SIZE_OPTIONS,
  addStrata, addPipe, addPump, addControlBox,
  removeStrata, removePipe, removePump, removeControlBox,
  onStrataTypeChange, applyCatalog, submit,
} = useDrillerWellForm(token);
</script>

<template>
  <div style="max-width:560px;margin:0 auto">
    <div v-if="loading" class="text-center py-10 text-medium-emphasis">กำลังโหลด...</div>

    <div v-else-if="saved" class="text-center py-16">
      <v-icon icon="mdi-check-circle" size="80" color="success" class="mb-4" />
      <div class="text-h5 font-weight-bold" style="color: #2E2418;">บันทึกสำเร็จ</div>
    </div>

    <v-card v-else-if="job" class="pa-5">
      <div class="text-center mb-4">
        <v-icon icon="mdi-water-check-outline" color="primary" size="40" class="mb-2" />
        <div class="text-h6 font-display font-weight-bold">บันทึกข้อมูลบ่อหลังเจาะ</div>
        <div class="text-caption text-medium-emphasis">
          คิวงาน: {{ job.job_title || `#${job.job_id}` }} · ลูกค้า: {{ job.customer_name }}
        </div>
      </div>

      <!-- ===== 1. ข้อมูลพื้นฐาน ===== -->
      <v-radio-group v-model="form.result" inline class="mb-3">
        <v-radio label="เจาะสำเร็จ" value="SUCCESS" />
        <v-radio label="เจาะไม่สำเร็จ" value="FAIL" />
      </v-radio-group>

      <v-text-field v-model="form.well_name" label="ชื่อบ่อ *" class="mb-3" />

      <v-row dense class="mb-1">
        <v-col cols="6"><v-text-field v-model="form.total_depth_m" type="number" label="ความลึกรวม (ม.) *" /></v-col>
        <v-col cols="6"><v-text-field v-model="form.water_quantity_m3hr" type="number" label="ปริมาณน้ำ (ม³/ชม.)" /></v-col>
      </v-row>
      <v-row dense class="mb-1">
        <v-col cols="6"><v-text-field v-model="form.yield_lpm" type="number" label="อัตราไหล (L/min)" /></v-col>
        <v-col cols="6"><v-text-field v-model="form.static_water_level_m" type="number" label="ระดับน้ำนิ่ง (ม.)" /></v-col>
      </v-row>
      <v-row dense class="mb-1">
        <v-col cols="6"><v-text-field v-model="form.pumping_water_level_m" type="number" label="ระดับน้ำลด (ม.)" /></v-col>
        <v-col cols="6"><v-text-field v-model="form.completion_date" type="date" label="วันที่เจาะเสร็จ" /></v-col>
      </v-row>
      <v-row dense class="mb-1">
        <v-col cols="6"><v-select v-model="form.drilling_method" :items="methodOptions" label="วิธีการเจาะ" /></v-col>
        <v-col cols="6"><v-select v-model="form.formation_water_type" :items="waterOptions" label="ประเภทน้ำ" /></v-col>
      </v-row>
      <v-text-field v-model="form.driller_name" label="ชื่อช่างผู้บันทึก" class="mb-3" />

      <v-text-field
        v-if="form.result === 'FAIL'"
        v-model="form.failure_reason" label="สาเหตุที่เจาะไม่สำเร็จ *"
        class="mb-3"
      />
      <v-textarea v-model="form.notes" label="บันทึกช่าง" rows="2" class="mb-3" />

      <v-divider class="my-4" />

      <!-- ===== 2. ชั้นดิน / ชั้นหิน ===== -->
      <div class="d-flex align-center justify-space-between mb-2">
        <div class="text-subtitle-1 font-display font-weight-bold">ชั้นดิน / ชั้นหิน</div>
        <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="addStrata">
          เพิ่มชั้น
        </v-btn>
      </div>
      <div class="text-caption text-medium-emphasis mb-2">
        ระบุแต่ละชั้นพร้อมระดับความลึก โดยเฉพาะชั้นน้ำบาดาล (ติ๊ก 💧)
      </div>

      <div
        v-for="(s, i) in form.strata" :key="i"
        class="pa-3 mb-3 rounded"
        style="border:1px solid rgba(0,0,0,0.12);background:rgba(0,0,0,0.02)"
      >
        <div class="d-flex align-center justify-space-between mb-1">
          <div class="font-weight-medium text-caption">ชั้นที่ {{ i + 1 }}</div>
          <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" @click="removeStrata(i)" />
        </div>
        <v-row dense class="mb-1">
          <v-col cols="6"><v-text-field v-model="s.depth_from_m" type="number" label="ความลึกเริ่ม (ม.) *" /></v-col>
          <v-col cols="6"><v-text-field v-model="s.depth_to_m" type="number" label="ความลึกสิ้นสุด (ม.) *" /></v-col>
        </v-row>
        <v-select
          v-model="s.lithology_type" :items="lithologyOptions"
          label="ประเภทดิน / หิน" placeholder="เช่น ดินลูกรัง, หินทราย"
          clearable class="mb-1" @update:model-value="onStrataTypeChange(s, $event)"
        />
        <v-row dense class="mb-1">
          <v-col cols="8"><v-text-field v-model="s.lithology_name" label="ชื่อชั้น" /></v-col>
          <v-col cols="4"><v-text-field v-model="s.color_hex" label="สี" type="color" /></v-col>
        </v-row>
        <v-row dense class="mb-1">
          <v-col cols="6"><v-select v-model="s.hardness" :items="hardnessOptions" label="ความแข็ง" clearable /></v-col>
        </v-row>
        <v-checkbox v-model="s.water_bearing" label="💧 ชั้นน้ำบาดาล (ชั้นหินอุ้มน้ำ)" color="primary" hide-details class="mb-1" />
        <v-text-field v-model="s.description" label="หมายเหตุ" />
      </div>

      <v-divider class="my-4" />

      <!-- ===== 3. โปรแกรมท่อบ่อ ===== -->
      <div class="d-flex align-center justify-space-between mb-2">
        <div class="text-subtitle-1 font-display font-weight-bold">โปรแกรมท่อบ่อ</div>
        <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="addPipe">
          เพิ่มช่วงท่อ
        </v-btn>
      </div>
      <div class="text-caption text-medium-emphasis mb-2">
        เช่น 10–40 ม. ใช้ท่อ PVC 6 นิ้ว ทึบ · 41–50 ม. ใช้ท่อ PVC 6 นิ้ว เซาะร่อง · ที่เหลือท่อทึบ
      </div>

      <div
        v-for="(p, i) in form.pipes" :key="i"
        class="pa-3 mb-3 rounded"
        style="border:1px solid rgba(0,0,0,0.12);background:rgba(0,0,0,0.02)"
      >
        <div class="d-flex align-center justify-space-between mb-1">
          <div class="font-weight-medium text-caption">ช่วงท่อที่ {{ i + 1 }}</div>
          <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" @click="removePipe(i)" />
        </div>
        <v-row dense class="mb-1">
          <v-col cols="6"><v-text-field v-model="p.depth_from_m" type="number" label="ความลึกเริ่ม (ม.) *" /></v-col>
          <v-col cols="6"><v-text-field v-model="p.depth_to_m" type="number" label="ความลึกสิ้นสุด (ม.) *" /></v-col>
        </v-row>
        <v-row dense class="mb-1">
          <v-col cols="6"><v-select v-model="p.material" :items="materialOptions" label="วัสดุ" /></v-col>
          <v-col cols="6"><v-select v-model="p.pipe_type" :items="pipeTypeOptions" label="ประเภทท่อ" /></v-col>
        </v-row>
        <v-row dense>
          <v-col cols="6">
            <v-combobox
              v-model="p.size_mm" :items="PIPE_SIZE_OPTIONS"
              item-title="title" item-value="value"
              label="ขนาดท่อ" placeholder="เลือกหรือพิมพ์ เช่น 160" clearable
            />
          </v-col>
          <v-col cols="6"><v-text-field v-model="p.quantity" type="number" label="จำนวนท่อ (ชิ้น)" /></v-col>
        </v-row>
      </div>

      <v-divider class="my-4" />

      <!-- ===== 4. ปั๊มน้ำ ===== -->
      <div class="d-flex align-center justify-space-between mb-2">
        <div class="text-subtitle-1 font-display font-weight-bold">ปั๊มน้ำบาดาล</div>
        <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="addPump">
          เพิ่มปั๊ม
        </v-btn>
      </div>

      <div
        v-for="p in form.pumps" :key="p.uid"
        class="pa-3 mb-3 rounded"
        style="border:1px solid rgba(0,0,0,0.12);background:rgba(0,0,0,0.02)"
      >
        <div class="d-flex align-center justify-space-between mb-1">
          <div class="font-weight-medium text-caption">ปั๊มที่ {{ form.pumps.indexOf(p) + 1 }}</div>
          <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" @click="removePump(form.pumps.indexOf(p))" />
        </div>

        <PumpCatalogPicker
          :model-value="null"
          label="รุ่นปั๊ม"
          @update:model-value="applyCatalog(p, $event)"
        />
      </div>

      <v-divider class="my-4" />

      <!-- ===== 5. ตู้คุมไฟ ===== -->
      <div class="d-flex align-center justify-space-between mb-2">
        <div class="text-subtitle-1 font-display font-weight-bold">ตู้คุมไฟ</div>
        <v-btn size="small" color="primary" variant="tonal" prepend-icon="mdi-plus" @click="addControlBox">
          เพิ่มตู้คุมไฟ
        </v-btn>
      </div>

      <div
        v-for="(c, i) in form.control_boxes" :key="i"
        class="pa-3 mb-3 rounded"
        style="border:1px solid rgba(0,0,0,0.12);background:rgba(0,0,0,0.02)"
      >
        <div class="d-flex align-center justify-space-between mb-1">
          <div class="font-weight-medium text-caption">ตู้คุมไฟที่ {{ i + 1 }}</div>
          <v-btn icon="mdi-delete-outline" size="small" variant="text" color="error" @click="removeControlBox(i)" />
        </div>
        <v-row dense class="mb-1">
          <v-col cols="6"><v-text-field v-model="c.brand" label="ยี่ห้อ" /></v-col>
          <v-col cols="6"><v-text-field v-model="c.model" label="รุ่น" /></v-col>
        </v-row>
        <v-row dense class="mb-1">
          <v-col cols="6"><v-text-field v-model="c.capacity" label="กำลัง (HP/kW)" /></v-col>
          <v-col cols="6"><v-text-field v-model="c.voltage" label="แรงดัน (V)" /></v-col>
        </v-row>
        <v-select v-model="c.protection_type" :items="protectionOptions" label="ระบบป้องกัน" clearable class="mb-1" />
        <v-text-field v-model="c.features" label="อุปกรณ์ในตู้" placeholder="เช่น คอนแทคเตอร์, รีเลย์, เบรกเกอร์" class="mb-1" />
        <v-text-field v-model="c.installed_date" type="date" label="วันที่ติดตั้ง" />
      </div>

      <v-divider class="my-4" />

      <v-btn
        color="primary" size="large" block variant="flat" :loading="submitting"
        :disabled="!form.well_name || !form.total_depth_m || (form.result === 'FAIL' && !form.failure_reason)"
        @click="submit"
      >บันทึกข้อมูล</v-btn>
    </v-card>

    <v-card v-else class="pa-6 text-center">
      <v-icon icon="mdi-link-off" size="40" class="mb-2" />
      <div class="text-h6 font-display font-weight-bold">ลิงก์ไม่ถูกต้องหรือหมดอายุ</div>
      <div class="text-caption text-medium-emphasis mt-1">กรุณาติดต่อเจ้าของระบบ</div>
    </v-card>
  </div>
</template>
