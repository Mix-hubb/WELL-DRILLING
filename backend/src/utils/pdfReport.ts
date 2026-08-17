import path from "path";
import PDFDocument from "pdfkit";
import { Response } from "express";
import { FullWell } from "../types";

const FONT_DIR = path.join(__dirname, "..", "..", "fonts");
const FONT_REGULAR = path.join(FONT_DIR, "Sarabun-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "Sarabun-Bold.ttf");

const MATERIAL_LABEL: Record<string, string> = {
  PVC: "PVC",
  STEEL: "เหล็ก",
  STAINLESS_STEEL: "สแตนเลส",
  HDPE: "HDPE",
  OTHER: "อื่นๆ",
};

const PIPE_TYPE_LABEL: Record<string, string> = {
  CASING: "ท่อปลอก",
  SCREEN: "ท่อกรอง",
};

const PUMP_TYPE_LABEL: Record<string, string> = {
  AC_SUBMERSIBLE: "ปั๊มจุ่ม AC",
  DC_SOLAR_SUBMERSIBLE: "ปั๊มจุ่มโซลาร์ DC",
  OTHER: "อื่นๆ",
};

const LITHOLOGY_TYPE_LABEL: Record<string, string> = {
  TOP_SOIL: "ดินบน",
  CLAY: "ดินเหนียว",
  SAND: "ทราย",
  GRAVEL: "กรวด",
  LATERITE: "ดินลูกรัง",
  SANDSTONE: "หินทราย",
  SHALE: "หินดินดาน",
  LIMESTONE: "หินปูน",
  GRANITE: "หินแกรนิต",
  BASALT: "หินบะซอลต์",
  HARDROCK: "หินแข็ง",
  OTHER: "อื่นๆ",
};

const PROTECTION_TYPE_LABEL: Record<string, string> = {
  OVERLOAD_RELAY: "รีเลย์กันโหลดเกิน",
  CIRCUIT_BREAKER: "เบรกเกอร์",
  AUTO_RESTART: "ตัดต่ออัตโนมัติ",
  WATER_LEVEL: "คอนโทรลระดับน้ำ",
  LIGHTNING: "กันฟ้าผ่า",
  NONE: "ไม่มี",
  OTHER: "อื่นๆ",
};

interface JobInfo {
  job_title: string;
  site_address: string;
  customer_name: string;
  driller_name: string;
  scheduled_date: string;
}

interface StrataRow {
  depth_from_m: number;
  depth_to_m: number;
  lithology_type?: string;
  lithology_name?: string;
  description?: string;
}

export function streamWellReportPdf(res: Response, well: FullWell, job: JobInfo) {
  const doc = new PDFDocument({ size: "A4", margin: 50, autoFirstPage: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="well-report-${well.well_id}.pdf"`);
  doc.pipe(res);

  doc.registerFont("Thai", FONT_REGULAR);
  doc.registerFont("ThaiBold", FONT_BOLD);

  doc.font("ThaiBold").fontSize(20).text("รายงานผลการเจาะบ่อ", { align: "left" });
  doc.moveDown(0.3);
  doc.font("Thai").fontSize(10).fillColor("#666").text(`รหัสบ่อ #${well.well_id}  ·  วันที่ออกรายงาน ${new Date().toISOString().slice(0, 10)}`);
  doc.moveDown(1);

  doc.fillColor("#111").fontSize(13).font("ThaiBold").text(job.job_title);
  doc.font("Thai").fontSize(10).fillColor("#444").text(job.site_address);
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor("#111").text(`ลูกค้า: ${job.customer_name}`);
  doc.text(`ผู้เจาะ: ${job.driller_name}`);
  doc.text(`วันที่เจาะ: ${job.scheduled_date}`);
  doc.moveDown(1);

  doc.rect(50, doc.y, 495, 70).strokeColor("#ccc").stroke();
  const statY = doc.y + 12;
  const stats: [string, string][] = [
    ["ความลึกรวม", well.total_depth_m != null ? `${well.total_depth_m} ม.` : "-"],
    ["อัตราไหล", well.water_quantity_m3hr != null ? `${well.water_quantity_m3hr} ลบ.ม./ชม.` : "-"],
    ["ระดับน้ำคงที่", well.static_water_level_m != null ? `${well.static_water_level_m} ม.` : "-"],
    ["ระดับน้ำสูบ", well.pumping_water_level_m != null ? `${well.pumping_water_level_m} ม.` : "-"],
  ];
  stats.forEach(([label, value], i) => {
    const x = 62 + (i % 2) * 240;
    const y = statY + Math.floor(i / 2) * 26;
    doc.fontSize(8).fillColor("#888").font("Thai").text(label, x, y);
    doc.fontSize(12).fillColor("#111").font("ThaiBold").text(value, x, y + 11);
  });
  doc.moveDown(6);

  doc.font("ThaiBold").fontSize(13).fillColor("#111").text("บันทึกชั้นหิน", { underline: false });
  doc.moveDown(0.3);
  tableHeader(doc, ["ความลึก (ม.)", "ชนิดหิน", "หมายเหตุ"], [90, 150, 255]);
  (well.strata as StrataRow[] || []).forEach((s) => {
    const litho = s.lithology_type
      ? LITHOLOGY_TYPE_LABEL[s.lithology_type] || s.lithology_name || "-"
      : s.lithology_name || "-";
    tableRow(doc, [
      `${s.depth_from_m}-${s.depth_to_m}`,
      litho,
      s.description || "-",
    ], [90, 150, 255]);
  });
  doc.moveDown(1);

  doc.font("ThaiBold").fontSize(13).fillColor("#111").text("ท่อปลอก / ท่อกรอง");
  doc.moveDown(0.3);
  tableHeader(doc, ["ความลึก (ม.)", "วัสดุ/ชนิด", "ขนาด", "จำนวน"], [90, 150, 100, 155]);
  (well.pipes || []).forEach((p) => {
    tableRow(doc, [
      `${p.depth_from_m}-${p.depth_to_m}`,
      `${MATERIAL_LABEL[p.material || "OTHER"] || "-"} ${PIPE_TYPE_LABEL[p.pipe_type || ""] || ""}`.trim() || "-",
      p.size_mm != null ? `${p.size_mm} มม.` : "-",
      String(p.quantity),
    ], [90, 150, 100, 155]);
  });
  doc.moveDown(1);

  doc.font("ThaiBold").fontSize(13).fillColor("#111").text("การติดตั้งปั๊ม");
  doc.moveDown(0.3);
  tableHeader(doc, ["ชนิด", "ยี่ห้อ/รุ่น", "แรงม้า", "ความลึก (ม.)"], [120, 190, 90, 95]);
  (well.pumps || []).forEach((p) => {
    const brandModel = [p.brand, p.pump_model].filter(Boolean).join(" ") || "-";
    tableRow(doc, [
      PUMP_TYPE_LABEL[p.pump_type || "OTHER"] || "-",
      brandModel,
      p.horsepower != null ? String(p.horsepower) : "-",
      p.installation_depth_m != null ? String(p.installation_depth_m) : "-",
    ], [120, 190, 90, 95]);
  });

  if (well.control_boxes?.length) {
    doc.moveDown(1);
    doc.font("ThaiBold").fontSize(13).fillColor("#111").text("ตู้คอนโทรล");
    doc.moveDown(0.3);
    tableHeader(doc, ["ยี่ห้อ", "รุ่น", "พิกัด", "ระบบป้องกัน"], [120, 170, 90, 115]);
    well.control_boxes.forEach((c) => {
      const protection = c.protection_type
        ? PROTECTION_TYPE_LABEL[c.protection_type] || c.protection_type
        : (c.voltage || "-");
      tableRow(doc, [
        c.brand || "-",
        c.model || "-",
        c.capacity || "-",
        protection,
      ], [120, 170, 90, 115]);
    });
  }

  if (well.notes) {
    doc.moveDown(1);
    doc.font("ThaiBold").fontSize(13).fillColor("#111").text("หมายเหตุ");
    doc.font("Thai").fontSize(10).fillColor("#444").text(well.notes);
  }

  doc.end();
}

function tableHeader(doc: PDFKit.PDFDocument, cols: string[], widths: number[]) {
  let x = 50;
  doc.fontSize(9).fillColor("#888").font("ThaiBold");
  cols.forEach((c, i) => { doc.text(c, x, doc.y, { width: widths[i], continued: false }); x += widths[i]; });
  doc.moveDown(0.4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.3);
}

function tableRow(doc: PDFKit.PDFDocument, cols: string[], widths: number[]) {
  const rowY = doc.y;
  let x = 50;
  doc.fontSize(9).fillColor("#222").font("Thai");
  cols.forEach((c, i) => { doc.text(c, x, rowY, { width: widths[i] }); x += widths[i]; });
  doc.moveDown(0.5);
}
