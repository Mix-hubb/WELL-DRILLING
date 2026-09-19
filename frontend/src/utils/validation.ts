export const requiredField = (message: string) => (value: unknown) => {
  if (value === null || value === undefined || value === "") return message;
  if (typeof value === "string" && value.trim() === "") return message;
  if (Array.isArray(value) && value.length === 0) return message;
  return true;
};

export const validEmail = (message: string) => (value: string) => {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || message;
};

export const validPhone = (message = "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก (ขึ้นต้นด้วย 0)") => (value: string) => {
  if (!value) return true;
  const clean = value.replace(/\D/g, "");
  return /^0\d{8,9}$/.test(clean) || message;
};

export const validThaiPhone = validPhone;

export const validNumber = (message = "กรุณากรอกตัวเลขที่ถูกต้อง", min?: number, max?: number) => (value: unknown) => {
  if (value === null || value === undefined || value === "") return true;
  const num = Number(value);
  if (Number.isNaN(num)) return message;
  if (min !== undefined && num < min) return `ค่าต้องไม่น้อยกว่า ${min}`;
  if (max !== undefined && num > max) return `ค่าต้องไม่เกิน ${max}`;
  return true;
};

/**
 * ดักจับแป้นพิมพ์: ป้องกันการพิมพ์ตัวอักษรหรือสัญลักษณ์ อนุญาตเฉพาะ 0-9 และปุ่มควบคุม
 */
export function allowOnlyDigits(e: KeyboardEvent) {
  if (
    !/^\d$/.test(e.key) &&
    !["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(e.key) &&
    !e.ctrlKey &&
    !e.metaKey
  ) {
    e.preventDefault();
  }
}

/**
 * กรองข้อความให้เหลือเฉพาะตัวเลข 0-9 และตัดความยาวสูงสุดตามที่กำหนด (ค่าเริ่มต้น 10 หลัก)
 */
export function cleanDigits(val: string | null | undefined, maxLen = 10): string {
  return String(val || "").replace(/\D/g, "").slice(0, maxLen);
}

/**
 * ทำความสะอาดเบอร์โทรศัพท์ (เฉพาะตัวเลข สูงสุด 10 หลัก)
 */
export function cleanPhoneNumber(val: string | null | undefined): string {
  return cleanDigits(val, 10);
}
