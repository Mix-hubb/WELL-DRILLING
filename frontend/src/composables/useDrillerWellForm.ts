import { onMounted, ref } from "vue";
import { jobsApi } from "@/api/jobs";
import { useUiStore } from "@/stores/ui";
import type { DrillingJob, PumpCatalogModel } from "@/types";
import {
  DRILLING_METHOD, WATER_TYPE, HARDNESS, LITHOLOGY_TYPE, LITHOLOGY_COLOR,
  PIPE_MATERIAL, PIPE_TYPE, PIPE_SIZE_OPTIONS, PROTECTION_TYPE,
} from "@/constants";

export interface StrataEntry {
  depth_from_m: string; depth_to_m: string;
  lithology_type: string; lithology_name: string;
  color_hex: string; water_bearing: boolean;
  hardness: string; description: string;
}

export interface PipeEntry {
  depth_from_m: string; depth_to_m: string;
  material: string; pipe_type: string;
  size_mm: string; quantity: number;
}

export interface PumpEntry {
  uid: string; pump_type: string; brand: string; pump_model: string;
  horsepower: string; power_kw: string; impeller_stages: string;
  installation_depth_m: string; voltage: string; phase: number | null;
  discharge_size_mm: string; rated_flow_m3hr: string; rated_head_m: string;
  installed_date: string;
}

export interface ControlBoxEntry {
  brand: string; model: string; capacity: string; voltage: string;
  protection_type: string; features: string; installed_date: string;
}

const today = () => new Date().toISOString().slice(0, 10);

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
  installed_date: today(),
});

const emptyControlBox = (): ControlBoxEntry => ({
  brand: "", model: "", capacity: "", voltage: "",
  protection_type: "", features: "", installed_date: today(),
});

export function useDrillerWellForm(token: string) {
  const ui = useUiStore();
  const job = ref<DrillingJob | null>(null);
  const loading = ref(true);
  const submitting = ref(false);
  const saved = ref(false);

  const methodOptions = Object.entries(DRILLING_METHOD).map(([value, title]) => ({ value, title }));
  const waterOptions = Object.entries(WATER_TYPE).map(([value, title]) => ({ value, title }));
  const hardnessOptions = Object.entries(HARDNESS).map(([value, title]) => ({ value, title }));
  const lithologyOptions = Object.entries(LITHOLOGY_TYPE).map(([value, title]) => ({ value, title }));
  const materialOptions = Object.entries(PIPE_MATERIAL).map(([value, title]) => ({ value, title }));
  const pipeTypeOptions = Object.entries(PIPE_TYPE).map(([value, title]) => ({ value, title }));
  const protectionOptions = Object.entries(PROTECTION_TYPE).map(([value, title]) => ({ value, title }));

  const form = ref({
    well_name: "", driller_name: "", result: "SUCCESS", failure_reason: "",
    total_depth_m: "", water_quantity_m3hr: "", yield_lpm: "",
    static_water_level_m: "", pumping_water_level_m: "", completion_date: today(),
    drilling_method: "ROTARY", formation_water_type: "FRESH", notes: "",
    strata: [] as StrataEntry[], pipes: [] as PipeEntry[], pumps: [] as PumpEntry[],
    control_boxes: [] as ControlBoxEntry[],
  });

  onMounted(async () => {
    try {
      job.value = await jobsApi.getByMagicToken(token);
      form.value.well_name = job.value.job_title || "";
    } catch (error) {
      ui.notifyError(error);
    } finally {
      loading.value = false;
    }
  });

  function addStrata() { form.value.strata.push(emptyStrata()); }
  function addPipe() { form.value.pipes.push(emptyPipe()); }
  function addPump() { form.value.pumps.push(emptyPump()); }
  function addControlBox() { form.value.control_boxes.push(emptyControlBox()); }
  function removeStrata(index: number) { form.value.strata.splice(index, 1); }
  function removePipe(index: number) { form.value.pipes.splice(index, 1); }
  function removePump(index: number) { form.value.pumps.splice(index, 1); }
  function removeControlBox(index: number) { form.value.control_boxes.splice(index, 1); }

  function onStrataTypeChange(strata: StrataEntry, value: string | null | undefined) {
    const type = (value || "") as keyof typeof LITHOLOGY_TYPE;
    if (LITHOLOGY_TYPE[type]) {
      strata.lithology_name = LITHOLOGY_TYPE[type];
      strata.color_hex = LITHOLOGY_COLOR[type] || "#A0856C";
    }
  }

  function firstNumber(value: string | null | undefined): number | null {
    if (!value) return null;
    const match = value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
    return match ? Number(match[1]) : null;
  }

  function parseKw(value: string | null | undefined): number | null {
    if (!value) return null;
    const clean = value.replace(/,/g, "");
    const kw = clean.match(/(\d+(?:\.\d+)?)\s*kw/i);
    if (kw) return Number(kw[1]);
    const watts = clean.match(/(\d+(?:\.\d+)?)\s*W(?!\w)/i);
    return watts ? Math.round((Number(watts[1]) / 1000) * 100) / 100 : null;
  }

  function parseVoltage(value: string | null | undefined): string {
    const match = value?.match(/(\d+(?:\.\d+)?)\s*V/i);
    return match ? match[1] : "";
  }

  function parsePhase(value: string | null | undefined): number | null {
    const match = value?.match(/(\d)\s*เฟส/);
    return match ? Number(match[1]) : null;
  }

  function parseDischargeMm(value: string | null | undefined): number | null {
    if (!value) return null;
    const match = value.replace(/,/g, "").match(/(\d+(?:\/\d+)?(?:\.\d+)?)"/);
    if (!match) return null;
    const inches = match[1].includes("/")
      ? Number(match[1].split("/")[0]) / Number(match[1].split("/")[1])
      : Number(match[1]);
    return Math.round(inches * 25.4 * 10) / 10;
  }

  function parseHead(value: string | null | undefined): number | null {
    if (!value) return null;
    const numbers = [...value.replace(/,/g, "").matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
    return numbers.length ? Math.max(...numbers) : null;
  }

  function applyCatalog(pump: PumpEntry, model: PumpCatalogModel | null) {
    if (!model) return;
    const solar = !!model.series?.includes("โซลาร์") || /dc/i.test(model.model);
    const drainage = !!model.series?.includes("ปั๊มจุ่ม");
    pump.pump_type = solar ? "DC_SOLAR_SUBMERSIBLE" : drainage ? "OTHER" : "AC_SUBMERSIBLE";
    pump.brand = model.brand;
    pump.pump_model = model.model;

    if (model.motor_power) {
      const kw = parseKw(model.motor_power);
      if (kw != null) pump.power_kw = String(kw);
      if (/hp/i.test(model.motor_power)) {
        const horsepower = firstNumber(model.motor_power);
        if (horsepower != null) pump.horsepower = String(horsepower);
      }
    }
    if (model.impeller_stages) {
      const stages = firstNumber(model.impeller_stages);
      pump.impeller_stages = stages != null ? String(stages) : "";
    }
    if (model.phase) {
      pump.voltage = parseVoltage(model.phase) || pump.voltage;
      const phase = parsePhase(model.phase);
      if (phase) pump.phase = phase;
    }
    if (model.discharge_size) {
      const size = parseDischargeMm(model.discharge_size);
      if (size != null) pump.discharge_size_mm = String(size);
    }
    if (model.max_head_m) {
      const head = parseHead(model.max_head_m);
      if (head != null) pump.rated_head_m = String(head);
    }
  }

  function buildPayload() {
    return {
      magic_token: token, well_name: form.value.well_name,
      driller_name: form.value.driller_name || null, result: form.value.result,
      failure_reason: form.value.result === "FAIL" ? (form.value.failure_reason || null) : null,
      total_depth_m: Number(form.value.total_depth_m),
      water_quantity_m3hr: form.value.water_quantity_m3hr ? Number(form.value.water_quantity_m3hr) : null,
      yield_lpm: form.value.yield_lpm ? Number(form.value.yield_lpm) : null,
      static_water_level_m: form.value.static_water_level_m ? Number(form.value.static_water_level_m) : null,
      pumping_water_level_m: form.value.pumping_water_level_m ? Number(form.value.pumping_water_level_m) : null,
      completion_date: form.value.completion_date,
      drilling_method: form.value.drilling_method || null,
      formation_water_type: form.value.formation_water_type || null,
      notes: form.value.notes || null,
      strata: form.value.strata.filter((entry) => entry.depth_from_m !== "" && entry.depth_to_m !== "").map((entry) => ({
        depth_from_m: Number(entry.depth_from_m), depth_to_m: Number(entry.depth_to_m),
        lithology_name: entry.lithology_name || null, color_hex: entry.color_hex || null,
        hardness: entry.hardness || null, water_bearing: entry.water_bearing ? 1 : 0,
        description: entry.description || null,
      })),
      pipes: form.value.pipes.filter((entry) => entry.depth_from_m !== "" && entry.depth_to_m !== "").map((entry) => ({
        depth_from_m: Number(entry.depth_from_m), depth_to_m: Number(entry.depth_to_m),
        material: entry.material || null, pipe_type: entry.pipe_type || null,
        size_mm: entry.size_mm !== "" ? Number(entry.size_mm) : null,
        quantity: Number(entry.quantity) || 1,
      })),
      pumps: form.value.pumps.filter((entry) => entry.brand || entry.pump_model).map((entry) => ({
        pump_type: entry.pump_type || null, brand: entry.brand || null, pump_model: entry.pump_model || null,
        horsepower: entry.horsepower ? Number(entry.horsepower) : null,
        power_kw: entry.power_kw ? Number(entry.power_kw) : null,
        impeller_stages: entry.impeller_stages ? Number(entry.impeller_stages) : null,
        installation_depth_m: entry.installation_depth_m ? Number(entry.installation_depth_m) : null,
        voltage: entry.voltage || null, phase: entry.phase ?? null,
        discharge_size_mm: entry.discharge_size_mm ? Number(entry.discharge_size_mm) : null,
        rated_flow_m3hr: entry.rated_flow_m3hr ? Number(entry.rated_flow_m3hr) : null,
        rated_head_m: entry.rated_head_m ? Number(entry.rated_head_m) : null,
        installed_date: entry.installed_date || null,
      })),
      control_boxes: form.value.control_boxes.map((entry) => ({
        brand: entry.brand || null, model: entry.model || null, capacity: entry.capacity || null,
        voltage: entry.voltage || null, protection_type: entry.protection_type || null,
        features: entry.features || null, installed_date: entry.installed_date || null,
      })),
    };
  }

  async function submit() {
    if (!job.value || !form.value.well_name || !form.value.total_depth_m) return;
    submitting.value = true;
    try {
      await jobsApi.completeWell(job.value.job_id, buildPayload());
      saved.value = true;
    } catch (error) {
      ui.notifyError(error);
    } finally {
      submitting.value = false;
    }
  }

  return {
    job, loading, submitting, saved, form,
    methodOptions, waterOptions, hardnessOptions, lithologyOptions,
    materialOptions, pipeTypeOptions, protectionOptions, PIPE_SIZE_OPTIONS,
    addStrata, addPipe, addPump, addControlBox,
    removeStrata, removePipe, removePump, removeControlBox,
    onStrataTypeChange, applyCatalog, submit,
  };
}