<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { jobsApi } from "@/api/jobs";
import { useUiStore } from "@/stores/ui";
import type { DrillingJob, PumpCatalogModel } from "@/types";
import PumpCatalogPicker from "@/components/PumpCatalogPicker.vue";
import {
  DRILLING_METHOD, WATER_TYPE, HARDNESS, LITHOLOGY_TYPE, LITHOLOGY_COLOR,
  PIPE_MATERIAL, PIPE_TYPE, PIPE_SIZE_OPTIONS, PROTECTION_TYPE,
} from "@/constants";

const route  = useRoute();
const ui     = useUiStore();

const job = ref<DrillingJob | null>(null);
const loading = ref(true);
const submitting = ref(false);
const token = route.params.token as string;

/* ---- option lists ---- */
const methodOptions    = Object.entries(DRILLING_METHOD).map(([value, title]) => ({ value, title }));
const waterOptions     = Object.entries(WATER_TYPE).map(([value, title]) => ({ value, title }));
const hardnessOptions  = Object.entries(HARDNESS).map(([value, title]) => ({ value, title }));
const lithologyOptions = Object.entries(LITHOLOGY_TYPE).map(([value, title]) => ({ value, title }));
const materialOptions  = Object.entries(PIPE_MATERIAL).map(([value, title]) => ({ value, title }));
const pipeTypeOptions  = Object.entries(PIPE_TYPE).map(([value, title]) => ({ value, title }));
const protectionOptions = Object.entries(PROTECTION_TYPE).map(([value, title]) => ({ value, title }));

/* ---- entry shapes ---- */
interface StrataEntry {
  depth_from_m: string; depth_to_m: string;
  lithology_type: string; lithology_name: string;
  color_hex: string; water_bearing: boolean;
  hardness: string; description: string;
}
interface PipeEntry {
  depth_from_m: string; depth_to_m: string;
  material: string; pipe_type: string;
  size_mm: string; quantity: number;
}
interface PumpEntry {
  uid: string; pump_type: string; brand: string; pump_model: string;
  horsepower: string; power_kw: string; impeller_stages: string;
  installation_depth_m: string; voltage: string; phase: number | null;
  discharge_size_mm: string; rated_flow_m3hr: string; rated_head_m: string;
  installed_date: string;
}
interface ControlBoxEntry {
  brand: string; model: string; capacity: string; voltage: string;
  protection_type: string; features: string; installed_date: string;
}

const emptyStrata = (): StrataEntry => ({
  depth_from_m: "", depth_to_m: "", lithology_type: "", lithology_name: "",
  color_hex: "#A0856C", water_bearing: false, hardness: "", description: "",
});
const emptyPipe = (): PipeEntry => ({
  depth_from_m: "", depth_to_m: "", material: "PVC", pipe_type: "CASING",
  size_mm: "", quantity: 1,
});
const emptyPump = (): PumpEntry => ({
  uid: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
  pump_type: "AC_SUBMERSIBLE", brand: "", pump_model: "",
  horsepower: "", power_kw: "", impeller_stages: "", installation_depth_m: "",
  voltage: "", phase: null, discharge_size_mm: "", rated_flow_m3hr: "", rated_head_m: "",
  installed_date: new Date().toISOString().slice(0, 10),
});
const emptyControlBox = (): ControlBoxEntry => ({
  brand: "", model: "", capacity: "", voltage: "",
  protection_type: "", features: "", installed_date: new Date().toISOString().slice(0, 10),
});

const form = ref({
  well_name:          "",
  driller_name:       "",
  result:             "SUCCESS",
  failure_reason:     "",
  total_depth_m:      "",
  water_quantity_m3hr: "",
  yield_lpm:          "",
  static_water_level_m: "",
  pumping_water_level_m: "",
  completion_date:    new Date().toISOString().slice(0, 10),
  drilling_method:    "ROTARY",
  formation_water_type: "FRESH",
  notes:              "",
  strata:             [] as StrataEntry[],
  pipes:              [] as PipeEntry[],
  pumps:              [] as PumpEntry[],
  control_boxes:      [] as ControlBoxEntry[],
});

const saved = ref(false);

onMounted(async () => {
  try {
    job.value = await jobsApi.getByMagicToken(token);
    form.value.well_name = job.value.job_title || "";
  } catch (e) {
    ui.notifyError(e);
  } finally {
    loading.value = false;
  }
});

/* ---- add / remove ---- */
function addStrata()      { form.value.strata.push(emptyStrata()); }
function addPipe()        { form.value.pipes.push(emptyPipe()); }
function addPump()        { form.value.pumps.push(emptyPump()); }
function addControlBox()  { form.value.control_boxes.push(emptyControlBox()); }

function removeStrata(i: number)     { form.value.strata.splice(i, 1); }
function removePipe(i: number)       { form.value.pipes.splice(i, 1); }
function removePump(i: number)       { form.value.pumps.splice(i, 1); }
function removeControlBox(i: number) { form.value.control_boxes.splice(i, 1); }

/* ตัวช่วย: เลือกประเภทดิน/หิน → ใส่ชื่อ + สีเริ่มต้นให้อัตโนมัติ */
function onStrataTypeChange(s: StrataEntry, val: string | null | undefined) {
  const t = (val || "") as keyof typeof LITHOLOGY_TYPE;
  if (LITHOLOGY_TYPE[t]) {
    s.lithology_name = LITHOLOGY_TYPE[t];
    s.color_hex = LITHOLOGY_COLOR[t] || "#A0856C";
  }
}

/* ---- ตัวช่วย parse ข้อมูลจากแคตตาล็อกปั๊ม (เลือกยี่ห้อ → รุ่น → กรอกอัตโนมัติ) ---- */
function firstNumber(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}
function parseKw(s: string | null | undefined): number | null {
  if (!s) return null;
  const clean = s.replace(/,/g, "");
  const kw = clean.match(/(\d+(?:\.\d+)?)\s*kw/i);
  if (kw) return Number(kw[1]);
  const w = clean.match(/(\d+(?:\.\d+)?)\s*W(?!\w)/i);
  if (w) return Math.round((Number(w[1]) / 1000) * 100) / 100;
  return null;
}
function parseVoltage(s: string | null | undefined): string {
  const m = s?.match(/(\d+(?:\.\d+)?)\s*V/i);
  return m ? m[1] : "";
}
function parsePhase(s: string | null | undefined): number | null {
  const m = s?.match(/(\d)\s*เฟส/);
  return m ? Number(m[1]) : null;
}
function parseDischargeMm(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/(\d+(?:\/\d+)?(?:\.\d+)?)"/);
  if (!m) return null;
  let inch = parseFloat(m[1]);
  if (m[1].includes("/")) {
    const [a, b] = m[1].split("/");
    inch = Number(a) / Number(b);
  }
  return Math.round(inch * 25.4 * 10) / 10;
}
function parseHead(s: string | null | undefined): number | null {
  if (!s) return null;
  const nums = [...s.replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)/g)].map((x) => Number(x[1]));
  return nums.length ? Math.max(...nums) : null;
}

function applyCatalog(p: PumpEntry, m: PumpCatalogModel | null) {
  if (!m) return;
  const solar = !!m.series?.includes("โซลาร์") || /dc/i.test(m.model);
  const drainage = !!m.series?.includes("ปั๊มจุ่ม");
  p.pump_type = solar ? "DC_SOLAR_SUBMERSIBLE" : drainage ? "OTHER" : "AC_SUBMERSIBLE";
  p.brand = m.brand;
  p.pump_model = m.model;

  if (m.motor_power) {
    const kw = parseKw(m.motor_power);
    if (kw != null) p.power_kw = String(kw);
    if (/hp/i.test(m.motor_power)) {
      const hp = firstNumber(m.motor_power);
      if (hp != null) p.horsepower = String(hp);
    }
  }
  if (m.impeller_stages) {
    const n = firstNumber(m.impeller_stages);
    p.impeller_stages = n != null ? String(n) : "";
  }
  if (m.phase) {
    p.voltage = parseVoltage(m.phase) || p.voltage;
    const ph = parsePhase(m.phase);
    if (ph) p.phase = ph;
  }
  if (m.discharge_size) {
    const mm = parseDischargeMm(m.discharge_size);
    if (mm != null) p.discharge_size_mm = String(mm);
  }
  if (m.max_head_m) {
    const h = parseHead(m.max_head_m);
    if (h != null) p.rated_head_m = String(h);
  }
}

function buildPayload() {
  return {
    magic_token:          token,
    well_name:            form.value.well_name,
    driller_name:         form.value.driller_name || null,
    result:               form.value.result,
    failure_reason:       form.value.result === "FAIL" ? (form.value.failure_reason || null) : null,
    total_depth_m:        Number(form.value.total_depth_m),
    water_quantity_m3hr:  form.value.water_quantity_m3hr ? Number(form.value.water_quantity_m3hr) : null,
    yield_lpm:            form.value.yield_lpm ? Number(form.value.yield_lpm) : null,
    static_water_level_m: form.value.static_water_level_m ? Number(form.value.static_water_level_m) : null,
    pumping_water_level_m: form.value.pumping_water_level_m ? Number(form.value.pumping_water_level_m) : null,
    completion_date:      form.value.completion_date,
    drilling_method:      form.value.drilling_method || null,
    formation_water_type: form.value.formation_water_type || null,
    notes:                form.value.notes || null,

    strata: form.value.strata
      .filter((s) => s.depth_from_m !== "" && s.depth_to_m !== "")
      .map((s) => ({
        depth_from_m:   Number(s.depth_from_m),
        depth_to_m:     Number(s.depth_to_m),
        lithology_name: s.lithology_name || null,
        color_hex:      s.color_hex || null,
        hardness:       s.hardness || null,
        water_bearing:  s.water_bearing ? 1 : 0,
        description:    s.description || null,
      })),

    pipes: form.value.pipes
      .filter((p) => p.depth_from_m !== "" && p.depth_to_m !== "")
      .map((p) => ({
        depth_from_m: Number(p.depth_from_m),
        depth_to_m:   Number(p.depth_to_m),
        material:     p.material || null,
        pipe_type:    p.pipe_type || null,
        size_mm:      p.size_mm !== "" ? Number(p.size_mm) : null,
        quantity:     Number(p.quantity) || 1,
      })),

    pumps: form.value.pumps
      .filter((p) => p.brand || p.pump_model)
      .map((p) => ({
      pump_type:            p.pump_type || null,
      brand:                p.brand || null,
      pump_model:           p.pump_model || null,
      horsepower:           p.horsepower ? Number(p.horsepower) : null,
      power_kw:             p.power_kw ? Number(p.power_kw) : null,
      impeller_stages:      p.impeller_stages ? Number(p.impeller_stages) : null,
      installation_depth_m: p.installation_depth_m ? Number(p.installation_depth_m) : null,
      voltage:              p.voltage || null,
      phase:                p.phase ?? null,
      discharge_size_mm:    p.discharge_size_mm ? Number(p.discharge_size_mm) : null,
      rated_flow_m3hr:      p.rated_flow_m3hr ? Number(p.rated_flow_m3hr) : null,
      rated_head_m:         p.rated_head_m ? Number(p.rated_head_m) : null,
      installed_date:       p.installed_date || null,
    })),

    control_boxes: form.value.control_boxes.map((c) => ({
      brand:           c.brand || null,
      model:           c.model || null,
      capacity:        c.capacity || null,
      voltage:         c.voltage || null,
      protection_type: c.protection_type || null,
      features:        c.features || null,
      installed_date:  c.installed_date || null,
    })),
  };
}

async function submit() {
  if (!job.value || !form.value.well_name || !form.value.total_depth_m) return;
  submitting.value = true;
  try {
    await jobsApi.completeWell(job.value.job_id, buildPayload());
    saved.value = true;
  } catch (e) {
    ui.notifyError(e);
  } finally {
    submitting.value = false;
  }
}
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
