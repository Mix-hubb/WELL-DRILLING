import type {
  DrillingJobStatus, DrillingRequestStatus, RepairRequestStatus,
  QuotationStatus, Hardness, PipeMaterial, PipeType,
  PumpType, DrillingMethod, WaterType, LithologyType, PumpBrand, ControlBoxProtection,
} from "@/types";

// ---------- Flow A: drilling request ----------
export const REQUEST_STATUS: Record<DrillingRequestStatus, { label: string; color: string }> = {
  NEW:       { label: "คำร้องใหม่",   color: "info" },
  QUOTED:    { label: "รอลูกค้ายืนยัน", color: "amber-darken-2" },
  ACCEPTED:  { label: "ยอมรับแล้ว",  color: "teal-darken-2" },
  REJECTED:  { label: "ปฏิเสธ",      color: "error" },
  CANCELLED: { label: "ยกเลิก",      color: "grey" },
};

// ---------- drilling job ----------
export const JOB_STATUS: Record<DrillingJobStatus, { label: string; color: string }> = {
  QUEUED:   { label: "รอเจาะ",       color: "amber-darken-2" },
  DRILLING: { label: "กำลังเจาะ",    color: "deep-orange-darken-1" },
  SUCCESS:  { label: "เจาะสำเร็จ",   color: "teal-darken-2" },
  FAILED:   { label: "เจาะไม่สำเร็จ", color: "red-darken-2" },
  CLOSED:   { label: "ปิดคิวแล้ว",   color: "grey" },
};

export const JOB_STATUS_HEX: Record<DrillingJobStatus, string> = {
  QUEUED:   "#8A6A2F",
  DRILLING: "#A8502F",
  SUCCESS:  "#1F5C61",
  FAILED:   "#B33A3A",
  CLOSED:   "#8A8078",
};

// ---------- Flow B: repair request ----------
export const REPAIR_STATUS: Record<RepairRequestStatus, { label: string; color: string }> = {
  NEW:          { label: "แจ้งใหม่",     color: "info" },
  QUOTED:       { label: "รอลูกค้ายืนยัน", color: "amber-darken-2" },
  ACCEPTED:     { label: "ยอมรับแล้ว",   color: "teal-darken-2" },
  REJECTED:     { label: "ปฏิเสธ",       color: "error" },
  SCHEDULED:    { label: "นัดซ่อมแล้ว",  color: "blue-darken-2" },
  IN_PROGRESS:  { label: "กำลังซ่อม",    color: "deep-orange-darken-1" },
  COMPLETED:    { label: "ซ่อมเสร็จ",    color: "teal-darken-2" },
  CLOSED:       { label: "ปิดงานแล้ว",   color: "grey-darken-1" },
  CANCELLED:    { label: "ยกเลิก",       color: "grey" },
};

// ---------- quotation ----------
export const QUOTATION_STATUS: Record<QuotationStatus, { label: string; color: string }> = {
  PENDING:  { label: "รอตอบรับ",  color: "amber-darken-2" },
  ACCEPTED: { label: "ยอมรับ",    color: "teal-darken-2" },
  REJECTED: { label: "ปฏิเสธ",    color: "error" },
};

// ---------- wells detail ----------
export const HARDNESS: Record<Hardness, string> = {
  VERY_SOFT: "อ่อนมาก",
  SOFT:      "อ่อน",
  MEDIUM:    "ปานกลาง",
  HARD:      "แข็ง",
  VERY_HARD: "แข็งมาก",
};

export const PIPE_MATERIAL: Record<PipeMaterial, string> = {
  PVC:             "PVC",
  STEEL:           "เหล็ก",
  STAINLESS_STEEL: "สแตนเลส",
  HDPE:            "HDPE",
  OTHER:           "อื่นๆ",
};

export const PIPE_TYPE: Record<PipeType, string> = {
  CASING: "ท่อกรุ (ทึบ)",
  SCREEN: "ท่อกรอง (เซาะร่อง)",
};

export const PUMP_TYPE: Record<PumpType, string> = {
  AC_SUBMERSIBLE:      "ซับเมอร์ส AC",
  DC_SOLAR_SUBMERSIBLE: "ซับเมอร์ส DC (โซลาร์)",
  OTHER:               "อื่นๆ",
};

export const DRILLING_METHOD: Record<DrillingMethod, string> = {
  ROTARY:    "โรตารี",
  DTH:       "DTH",
  CABLE_TOOL: "คันกระแทก",
  AUGER:     "สว่านเกลียว",
  JETTING:   "เจ็ตติ้ง",
  OTHER:     "อื่นๆ",
};

export const WATER_TYPE: Record<WaterType, string> = {
  FRESH:   "น้ำจืด",
  BRACKISH: "น้ำกร่อย",
  SALINE:  "น้ำเค็ม",
  UNKNOWN: "ไม่ทราบ",
};

// ---------- ลิโทโลจี (ประเภทดิน / หิน) ----------
export const LITHOLOGY_TYPE: Record<LithologyType, string> = {
  TOP_SOIL:   "ดินบน / หน้าดิน",
  CLAY:       "ดินเหนียว",
  SAND:       "ทราย",
  GRAVEL:     "กรวด",
  LATERITE:   "ดินลูกรัง",
  SANDSTONE:  "หินทราย",
  SHALE:      "หินดินดาน",
  LIMESTONE:  "หินปูน",
  GRANITE:    "หินแกรนิต",
  BASALT:     "หินบะซอลต์",
  HARDROCK:   "หินแข็ง",
  OTHER:      "อื่นๆ",
};

// สีเริ่มต้นของแต่ละประเภท (ใช้ใน StrataColumn)
export const LITHOLOGY_COLOR: Record<LithologyType, string> = {
  TOP_SOIL:  "#8B5E3C",
  CLAY:      "#9C6B4A",
  SAND:      "#D9C89A",
  GRAVEL:    "#A9A9A9",
  LATERITE:  "#B5651D",
  SANDSTONE: "#C2B280",
  SHALE:     "#6E6E6E",
  LIMESTONE: "#D6D6D6",
  GRANITE:   "#8F8F8F",
  BASALT:    "#4B4B4B",
  HARDROCK:  "#5A5A5A",
  OTHER:     "#A0856C",
};

// ---------- ยี่ห้อปั๊ม (dropdown) ----------
export const PUMP_BRAND: Record<PumpBrand, string> = {
  FRANKLIN: "Franklin Electric",
  TORQUE:   "TORQUE",
  GRUNDFOS: "Grundfos",
  HITACHI:  "Hitachi",
  PEDROLLO: "Pedrollo",
  MITSUBISHI: "Mitsubishi",
  KSB:      "KSB",
  TSURUMI:  "Tsurumi",
  LOWARA:   "Lowara",
  OTHER:    "อื่นๆ",
};

// ---------- ระบบป้องกันตู้คุมไฟ (dropdown) ----------
export const PROTECTION_TYPE: Record<ControlBoxProtection, string> = {
  OVERLOAD_RELAY:  "รีเลย์กันโหลดเกิน (OL)",
  CIRCUIT_BREAKER: "เบรกเกอร์ / MCB",
  AUTO_RESTART:    "ตัดต่ออัตโนมัติ (Auto-restart)",
  WATER_LEVEL:     "คอนโทรลระดับน้ำ",
  LIGHTNING:       "กันฟ้าผ่า (Surge)",
  NONE:            "ไม่มี",
  OTHER:           "อื่นๆ",
};

// ---------- ขนาดท่อบ่อที่นิยม (มม. พร้อม label นิ้ว) ----------
export const PIPE_SIZE_OPTIONS: { value: string; title: string }[] = [
  { value: "50",  title: "50 มม. (2\")" },
  { value: "63",  title: "63 มม. (2.5\")" },
  { value: "75",  title: "75 มม. (3\")" },
  { value: "90",  title: "90 มม. (3.5\")" },
  { value: "100", title: "100 มม. (4\")" },
  { value: "110", title: "110 มม. (4\")" },
  { value: "125", title: "125 มม. (5\")" },
  { value: "150", title: "150 มม. (6\")" },
  { value: "160", title: "160 มม. (6\")" },
  { value: "200", title: "200 มม. (8\")" },
  { value: "250", title: "250 มม. (10\")" },
];

export function money(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString("th-TH", { minimumFractionDigits: 0 });
}
