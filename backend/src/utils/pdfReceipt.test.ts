import { describe, it, expect, vi } from "vitest";
import { PassThrough } from "stream";
import { streamRepairReceiptPdf, ReceiptData } from "./pdfReceipt";

describe("streamRepairReceiptPdf", () => {
  it("generates a valid PDF stream with standard receipt data", () => {
    const mockRes = new PassThrough() as any;
    mockRes.setHeader = vi.fn();

    const data: ReceiptData = {
      receipt_no: "REC-20260319-0001",
      issued_date: "2026-03-19",
      org_name: "ห้างหุ้นส่วนจำกัด วารีพัฒนา",
      customer_name: "นายทองดี สุขใจ",
      customer_phone: "089-999-8888",
      customer_address: "123 หมู่ 4 ต.ในเมือง อ.เมือง จ.ขอนแก่น",
      repair_id: 101,
      well_id: 12,
      well_name: "บ่อไร่มะม่วง",
      problems: ["น้ำไม่ไหล", "เบรกเกอร์ทริป"],
      work_details: "ตรวจเช็คระบบไฟฟ้า เปลี่ยนปั๊มบาดาลและวาล์วกันกลับ",
      parts: [
        { name: "เช็ควาล์วทองเหลือง 2 นิ้ว", qty: 1, unit_price: 650 },
        { name: "สายไฟใต้น้ำ 3x2.5", qty: 20, unit_price: 45 },
      ],
      pump: {
        brand: "FRANKLIN",
        model: "10FPS05",
        motor_power: "1.5HP",
        reference_price: 12500,
      },
      is_warranty_claim: false,
      final_price: 14050,
      status: "COMPLETED",
    };

    expect(() => {
      streamRepairReceiptPdf(mockRes, data);
    }).not.toThrow();

    expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("receipt-repair-101.pdf")
    );
  });

  it("handles warranty claim receipt with 0 baht net total", () => {
    const mockRes = new PassThrough() as any;
    mockRes.setHeader = vi.fn();

    const data: ReceiptData = {
      receipt_no: "REC-20260319-0002",
      issued_date: "2026-03-19",
      org_name: "ช่างเด่น บาดาล",
      customer_name: "นางสมศรี",
      repair_id: 102,
      is_warranty_claim: true,
      work_details: "เปลี่ยนรีเลย์ในตู้คอนโทรล",
      final_price: 0,
      status: "COMPLETED",
    };

    expect(() => {
      streamRepairReceiptPdf(mockRes, data);
    }).not.toThrow();

    expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
  });
});
