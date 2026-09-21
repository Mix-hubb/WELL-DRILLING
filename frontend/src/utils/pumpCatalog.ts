import type { PumpCatalogModel, PumpType } from "@/types";

export interface DerivedPumpFields {
  pump_type: PumpType;
  brand: string;
  pump_model: string;
  horsepower: number | null;
  power_kw: number | null;
  impeller_stages: number | null;
  voltage: string | null;
  phase: number | null;
  discharge_size_mm: number | null;
  rated_head_m: number | null;
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

function parseVoltage(value: string | null | undefined): string | null {
  const match = value?.match(/(\d+(?:\.\d+)?)\s*V/i);
  return match ? match[1] : null;
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

/** แปลงข้อมูลรุ่นปั๊มจากแคตตาล็อกให้เป็นค่าฟิลด์ของปั๊มจริงที่จะบันทึกกับบ่อ */
export function deriveCatalogPumpFields(model: PumpCatalogModel): DerivedPumpFields {
  const solar = !!model.series?.includes("โซลาร์") || /dc/i.test(model.model);
  const drainage = !!model.series?.includes("ปั๊มจุ่ม");
  const pump_type: PumpType = solar ? "DC_SOLAR_SUBMERSIBLE" : drainage ? "OTHER" : "AC_SUBMERSIBLE";

  let horsepower: number | null = null;
  let power_kw: number | null = null;
  if (model.motor_power) {
    power_kw = parseKw(model.motor_power);
    if (/hp/i.test(model.motor_power)) {
      horsepower = firstNumber(model.motor_power);
    }
  }

  const impeller_stages = model.impeller_stages ? firstNumber(model.impeller_stages) : null;

  let voltage: string | null = null;
  let phase: number | null = null;
  if (model.phase) {
    voltage = parseVoltage(model.phase);
    phase = parsePhase(model.phase);
  }

  const discharge_size_mm = model.discharge_size ? parseDischargeMm(model.discharge_size) : null;
  const rated_head_m = model.max_head_m ? parseHead(model.max_head_m) : null;

  return {
    pump_type,
    brand: model.brand,
    pump_model: model.model,
    horsepower,
    power_kw,
    impeller_stages,
    voltage,
    phase,
    discharge_size_mm,
    rated_head_m,
  };
}
