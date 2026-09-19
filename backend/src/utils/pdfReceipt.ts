import path from "path";
import PDFDocument from "pdfkit";
import { Response } from "express";

const FONT_DIR = path.join(__dirname, "..", "..", "fonts");
const FONT_REGULAR = path.join(FONT_DIR, "Sarabun-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "Sarabun-Bold.ttf");

export interface ReceiptPart {
  name: string;
  qty: number;
  unit_price: number;
}

export interface ReceiptPump {
  brand?: string;
  model?: string;
  motor_power?: string;
  reference_price?: number;
}

export interface ReceiptData {
  receipt_no: string;
  issued_date: string;
  org_name: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  repair_id: number | string;
  well_id?: number | string | null;
  well_name?: string | null;
  problems?: string[];
  work_details?: string | null;
  parts?: ReceiptPart[];
  pump?: ReceiptPump | null;
  is_warranty_claim: boolean;
  final_price?: number | null;
  status?: string;
}

export function streamRepairReceiptPdf(res: Response, data: ReceiptData) {
  const doc = new PDFDocument({ size: "A4", margin: 40, autoFirstPage: true });

  const isAttachment = (res as any).req?.query?.download === "1" || (res as any).req?.query?.download === "true";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `${isAttachment ? "attachment" : "inline"}; filename="receipt-repair-${data.repair_id}.pdf"`
  );
  doc.pipe(res);

  doc.registerFont("Thai", FONT_REGULAR);
  doc.registerFont("ThaiBold", FONT_BOLD);

  const left = 45;
  const right = 550;
  const contentWidth = right - left;

  // Header Banner
  doc.rect(left, 40, contentWidth, 54).fillColor("#1B5E20").fill();
  doc.fillColor("#FFFFFF").font("ThaiBold").fontSize(18).text("ใบเสร็จรับเงิน / ใบส่งมอบงานซ่อม", left + 16, 50);
  doc.fontSize(10).font("Thai").text("RECEIPT / REPAIR SERVICE COMPLETION", left + 16, 73);

  doc.font("ThaiBold").fontSize(12).fillColor("#FFFFFF").text(data.receipt_no, left + 340, 52, { width: 150, align: "right" });
  doc.font("Thai").fontSize(9).text(`วันที่: ${data.issued_date}`, left + 340, 71, { width: 150, align: "right" });

  doc.y = 105;

  // Org Name
  doc.fillColor("#1B5E20").font("ThaiBold").fontSize(12).text(data.org_name || "บริการขุดเจาะและซ่อมบำรุงบ่อบาดาล", left, doc.y);
  doc.moveDown(0.4);

  // Customer & Repair Info Box
  const infoBoxY = doc.y;
  doc.rect(left, infoBoxY, contentWidth, 75).strokeColor("#E0E0E0").stroke();

  // Left column: Customer
  doc.font("ThaiBold").fontSize(10).fillColor("#333").text("ข้อมูลลูกค้า:", left + 12, infoBoxY + 8);
  doc.font("Thai").fontSize(9).fillColor("#111").text(`ชื่อ: ${data.customer_name || "-"}`, left + 12, infoBoxY + 23);
  doc.text(`เบอร์โทรศัพท์: ${data.customer_phone || "-"}`, left + 12, infoBoxY + 38);
  doc.text(`ที่อยู่: ${data.customer_address || "-"}`, left + 12, infoBoxY + 53, { width: 230, height: 20, ellipsis: true });

  // Right column: Repair & Well Info
  const col2X = left + 260;
  doc.font("ThaiBold").fontSize(10).fillColor("#333").text("ข้อมูลการซ่อม:", col2X, infoBoxY + 8);
  doc.font("Thai").fontSize(9).fillColor("#111").text(`รหัสงานซ่อม: #${data.repair_id}`, col2X, infoBoxY + 23);
  const wellText = data.well_name ? `${data.well_name} (รหัส #${data.well_id || "-"})` : `บ่อ #${data.well_id || "-"}`;
  doc.text(`บ่อบาดาล: ${data.well_id ? wellText : "ไม่ได้ระบุบ่อ"}`, col2X, infoBoxY + 38);
  const probText = data.problems?.length ? data.problems.join(", ") : "-";
  doc.text(`อาการที่แจ้ง: ${probText}`, col2X, infoBoxY + 53, { width: 230, height: 20, ellipsis: true });

  doc.y = infoBoxY + 85;

  // Work Details
  if (data.work_details) {
    doc.font("ThaiBold").fontSize(10).fillColor("#333").text("รายละเอียดการปฏิบัติงาน:");
    doc.moveDown(0.2);
    doc.font("Thai").fontSize(9).fillColor("#444").text(data.work_details, left + 10, doc.y, { width: contentWidth - 20 });
    doc.moveDown(0.6);
  }

  // Warranty Banner if applicable
  if (data.is_warranty_claim) {
    const bannerY = doc.y;
    doc.rect(left, bannerY, contentWidth, 24).fillColor("#E8F5E9").fill();
    doc.font("ThaiBold").fontSize(10).fillColor("#2E7D32").text("✓ งานซ่อมนี้อยู่ภายใต้การรับประกัน (เคลมประกัน ไม่มีค่าใช้จ่าย)", left + 12, bannerY + 6);
    doc.y = bannerY + 30;
  }

  // Items Table Header
  const tableY = doc.y + 4;
  doc.rect(left, tableY, contentWidth, 22).fillColor("#F5F5F5").fill();
  doc.rect(left, tableY, contentWidth, 22).strokeColor("#E0E0E0").stroke();

  doc.font("ThaiBold").fontSize(9).fillColor("#333");
  doc.text("ลำดับ", left + 8, tableY + 6, { width: 30, align: "center" });
  doc.text("รายการ / รายละเอียด", left + 45, tableY + 6, { width: 260 });
  doc.text("จำนวน", left + 310, tableY + 6, { width: 50, align: "center" });
  doc.text("ราคา/หน่วย", left + 365, tableY + 6, { width: 65, align: "right" });
  doc.text("จำนวนเงิน (บาท)", left + 435, tableY + 6, { width: 65, align: "right" });

  let curY = tableY + 22;
  let itemIndex = 1;
  let partsTotal = 0;

  // Row items: Parts
  if (data.parts && data.parts.length > 0) {
    for (const part of data.parts) {
      const lineTotal = (Number(part.qty) || 0) * (Number(part.unit_price) || 0);
      partsTotal += lineTotal;

      doc.rect(left, curY, contentWidth, 20).strokeColor("#EEEEEE").stroke();
      doc.font("Thai").fontSize(9).fillColor("#222");
      doc.text(String(itemIndex++), left + 8, curY + 5, { width: 30, align: "center" });
      doc.text(part.name || "อะไหล่", left + 45, curY + 5, { width: 260, ellipsis: true });
      doc.text(String(part.qty || 1), left + 310, curY + 5, { width: 50, align: "center" });
      doc.text(Number(part.unit_price || 0).toLocaleString("th-TH", { minimumFractionDigits: 2 }), left + 365, curY + 5, { width: 65, align: "right" });
      doc.text(lineTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 }), left + 435, curY + 5, { width: 65, align: "right" });
      curY += 20;
    }
  }

  // Row item: Pump replacement if any
  if (data.pump && (data.pump.brand || data.pump.model)) {
    const pumpDesc = `ปั๊มบาดาล ${data.pump.brand || ""} ${data.pump.model || ""} ${data.pump.motor_power ? `(${data.pump.motor_power})` : ""}`.trim();
    const pumpPrice = Number(data.pump.reference_price) || 0;
    partsTotal += pumpPrice;

    doc.rect(left, curY, contentWidth, 20).strokeColor("#EEEEEE").stroke();
    doc.font("Thai").fontSize(9).fillColor("#222");
    doc.text(String(itemIndex++), left + 8, curY + 5, { width: 30, align: "center" });
    doc.text(pumpDesc, left + 45, curY + 5, { width: 260, ellipsis: true });
    doc.text("1", left + 310, curY + 5, { width: 50, align: "center" });
    doc.text(pumpPrice > 0 ? pumpPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-", left + 365, curY + 5, { width: 65, align: "right" });
    doc.text(pumpPrice > 0 ? pumpPrice.toLocaleString("th-TH", { minimumFractionDigits: 2 }) : "-", left + 435, curY + 5, { width: 65, align: "right" });
    curY += 20;
  }

  // If no items were listed but there is a final price or work description
  if (itemIndex === 1) {
    const mainDesc = data.work_details || "ค่าบริการซ่อมบำรุงบ่อบาดาล";
    const serviceFee = data.is_warranty_claim ? 0 : (data.final_price != null ? Number(data.final_price) : 0);

    doc.rect(left, curY, contentWidth, 20).strokeColor("#EEEEEE").stroke();
    doc.font("Thai").fontSize(9).fillColor("#222");
    doc.text("1", left + 8, curY + 5, { width: 30, align: "center" });
    doc.text(mainDesc, left + 45, curY + 5, { width: 260, ellipsis: true });
    doc.text("1", left + 310, curY + 5, { width: 50, align: "center" });
    doc.text(serviceFee.toLocaleString("th-TH", { minimumFractionDigits: 2 }), left + 365, curY + 5, { width: 65, align: "right" });
    doc.text(serviceFee.toLocaleString("th-TH", { minimumFractionDigits: 2 }), left + 435, curY + 5, { width: 65, align: "right" });
    curY += 20;
  }

  // Summary Box
  const summaryY = curY + 8;
  const netTotal = data.is_warranty_claim
    ? 0
    : (data.final_price != null ? Number(data.final_price) : partsTotal);

  doc.rect(left + 260, summaryY, contentWidth - 260, 48).strokeColor("#1B5E20").lineWidth(1).stroke();
  doc.rect(left + 260, summaryY, contentWidth - 260, 48).fillColor("#F1F8E9").fill();

  doc.font("ThaiBold").fontSize(11).fillColor("#1B5E20").text("ยอดรวมสุทธิ (Total):", left + 270, summaryY + 16);
  doc.font("ThaiBold").fontSize(15).fillColor("#1B5E20").text(
    `${netTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`,
    left + 270,
    summaryY + 14,
    { width: contentWidth - 280, align: "right" }
  );

  // Signatures / Footer
  const signY = Math.max(summaryY + 70, 680);

  doc.font("Thai").fontSize(9).fillColor("#666");
  doc.text("ลงชื่อ ...........................................................", left + 40, signY);
  doc.text("(                                                               )", left + 40, signY + 16);
  doc.text("ผู้ส่งมอบงาน / ช่างผู้ให้บริการ", left + 75, signY + 32);

  doc.text("ลงชื่อ ...........................................................", left + 320, signY);
  doc.text(`(  ${data.customer_name || "ลูกค้าผู้รับบริการ"}  )`, left + 320, signY + 16, { width: 170, align: "center" });
  doc.text("ผู้รับบริการ / ผู้ชำระเงิน", left + 355, signY + 32);

  // Bottom Notice
  doc.font("Thai").fontSize(8).fillColor("#888").text(
    "เอกสารนี้สร้างขึ้นโดยระบบบริการจัดการขุดเจาะและซ่อมบำรุงบ่อบาดาลอัตโนมัติ ขอบคุณที่ไว้วางใจใช้บริการ",
    left,
    760,
    { width: contentWidth, align: "center" }
  );

  doc.end();
}
