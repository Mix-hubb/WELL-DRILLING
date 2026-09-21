import { describe, it, expect, vi } from "vitest";
import {
  requiredField,
  validEmail,
  validPhone,
  validThaiPhone,
  allowOnlyDigits,
  cleanPhoneNumber,
  cleanDigits,
} from "./validation";

describe("validation utils", () => {
  describe("requiredField", () => {
    const rule = requiredField("กรุณากรอกข้อมูล");

    it("returns message when empty or whitespace", () => {
      expect(rule("")).toBe("กรุณากรอกข้อมูล");
      expect(rule("   ")).toBe("กรุณากรอกข้อมูล");
      expect(rule(null)).toBe("กรุณากรอกข้อมูล");
      expect(rule(undefined)).toBe("กรุณากรอกข้อมูล");
      expect(rule([])).toBe("กรุณากรอกข้อมูล");
    });

    it("returns true when valid", () => {
      expect(rule("ข้อความ")).toBe(true);
      expect(rule(0)).toBe(true);
      expect(rule(["item"])).toBe(true);
    });
  });

  describe("validEmail", () => {
    const rule = validEmail("อีเมลไม่ถูกต้อง");

    it("allows empty value", () => {
      expect(rule("")).toBe(true);
    });

    it("validates email formats", () => {
      expect(rule("test@example.com")).toBe(true);
      expect(rule("invalid-email")).toBe("อีเมลไม่ถูกต้อง");
      expect(rule("test@")).toBe("อีเมลไม่ถูกต้อง");
    });
  });

  describe("validThaiPhone", () => {
    const rule = validThaiPhone("เบอร์โทรไม่ถูกต้อง");

    it("allows empty value", () => {
      expect(rule("")).toBe(true);
    });

    it("accepts 10-digit mobile numbers starting with 0", () => {
      expect(rule("0812345678")).toBe(true);
      expect(rule("0998887777")).toBe(true);
    });

    it("accepts 9-digit landline numbers starting with 0", () => {
      expect(rule("021234567")).toBe(true);
    });

    it("rejects numbers not starting with 0", () => {
      expect(rule("1812345678")).toBe("เบอร์โทรไม่ถูกต้อง");
      expect(rule("812345678")).toBe("เบอร์โทรไม่ถูกต้อง");
    });

    it("rejects too short or too long numbers", () => {
      expect(rule("0812345")).toBe("เบอร์โทรไม่ถูกต้อง");
      expect(rule("081234567890")).toBe("เบอร์โทรไม่ถูกต้อง");
    });

    it("rejects non-digits if passed", () => {
      expect(rule("08123abcde")).toBe("เบอร์โทรไม่ถูกต้อง");
    });
  });

  describe("cleanPhoneNumber", () => {
    it("strips letters and symbols and limits to 10 digits", () => {
      expect(cleanPhoneNumber("081-234-5678")).toBe("0812345678");
      expect(cleanPhoneNumber("081abc234def5678")).toBe("0812345678");
      expect(cleanPhoneNumber("+66 81 234 5678 extra")).toBe("6681234567");
    });

    it("handles null/undefined", () => {
      expect(cleanPhoneNumber(null)).toBe("");
      expect(cleanPhoneNumber(undefined)).toBe("");
    });
  });

  describe("allowOnlyDigits", () => {
    it("prevents letters and symbols", () => {
      const e1 = { key: "a", preventDefault: vi.fn(), ctrlKey: false, metaKey: false } as any;
      allowOnlyDigits(e1);
      expect(e1.preventDefault).toHaveBeenCalled();

      const e2 = { key: "-", preventDefault: vi.fn(), ctrlKey: false, metaKey: false } as any;
      allowOnlyDigits(e2);
      expect(e2.preventDefault).toHaveBeenCalled();
    });

    it("allows digit keys", () => {
      const e = { key: "5", preventDefault: vi.fn(), ctrlKey: false, metaKey: false } as any;
      allowOnlyDigits(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    });

    it("allows control keys like Backspace, Arrow keys", () => {
      const e = { key: "Backspace", preventDefault: vi.fn(), ctrlKey: false, metaKey: false } as any;
      allowOnlyDigits(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
    });
  });
});
