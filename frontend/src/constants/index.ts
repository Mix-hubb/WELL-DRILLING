import type { JobStatus, StrataType, PipeType, PipeSize, ThicknessClass, PumpType } from "@/types";

export const STRATA: Record<StrataType, { label: string; color: string }> = {
  BANGKOK_CLAY:        { label: "ดินเหนียวกรุงเทพฯ",     color: "#8B6F5C" },
  SILTY_SAND:          { label: "ทรายแป้ง/ทรายดูด",       color: "#D9C398" },
  GRAVEL:              { label: "กรวด",                    color: "#A8A296" },
  SANDSTONE:           { label: "หินทราย",                 color: "#C97C4B" },
  MAHA_SARAKHAM_SALT:  { label: "ชั้นเกลือมหาสารคาม",      color: "#EDE4E0" },
  SHALE:               { label: "หินดินดาน",                color: "#4A4540" },
  LIMESTONE:           { label: "หินปูน",                   color: "#B9C4C2" },
  GRANITE:             { label: "หินแกรนิต",                color: "#8E7B8B" },
  OTHER:               { label: "อื่นๆ",                    color: "#6B6B6B" },
};

export const PIPE_TYPE: Record<PipeType, string> = {
  CASING_PVC: "ท่อกรุ PVC",
  SCREEN_PVC: "ท่อกรอง PVC",
  CASING_STEEL: "ท่อกรุเหล็ก",
  SCREEN_STEEL: "ท่อกรองเหล็ก",
};

export const PIPE_SIZE: Record<PipeSize, string> = {
  "4_INCH": "4 นิ้ว", "5_INCH": "5 นิ้ว", "6_INCH": "6 นิ้ว", "8_INCH": "8 นิ้ว",
};

export const THICKNESS: Record<ThicknessClass, string> = {
  "CLASS_8.5": "Class 8.5",
  "CLASS_13.5": "Class 13.5",
  STEEL_STANDARD: "มาตรฐานเหล็ก",
  NONE: "-",
};

export const PUMP_TYPE: Record<PumpType, string> = {
  AC_SUBMERSIBLE: "ซับเมอร์ส AC",
  DC_SOLAR_SUBMERSIBLE: "ซับเมอร์ส DC (โซลาร์)",
  OTHER: "อื่นๆ",
};

export const STATUS: Record<JobStatus, { label: string; color: string }> = {
  PENDING:   { label: "รอดำเนินการ", color: "amber-darken-2" },
  DRILLING:  { label: "กำลังเจาะ",   color: "deep-orange-darken-1" },
  COMPLETED: { label: "เจาะสำเร็จ",  color: "teal-darken-2" },
  ARCHIVED:  { label: "เก็บถาวร",    color: "grey" },
};

export const STATUS_HEX: Record<JobStatus, string> = {
  PENDING:   "#8A6A2F",
  DRILLING:  "#A8502F",
  COMPLETED: "#1F5C61",
  ARCHIVED:  "#8A8078",
};

export function money(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0 });
}
