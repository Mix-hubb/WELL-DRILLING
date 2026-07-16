import path from "path";
import PDFDocument from "pdfkit";
import { Response } from "express";
import { FullWell } from "../types";

const FONT_DIR = path.join(__dirname, "..", "..", "fonts");
const FONT_REGULAR = path.join(FONT_DIR, "Sarabun-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "Sarabun-Bold.ttf");

const PIPE_TYPE_LABEL: Record<string, string> = {
  CASING_PVC: "ท่อปลอก PVC",
  SCREEN_PVC: "ท่อกรอง PVC",
  CASING_STEEL: "ท่อปลอกเหล็ก",
  SCREEN_STEEL: "ท่อกรองเหล็ก",
};

const PUMP_TYPE_LABEL: Record<string, string> = {
  AC_SUBMERSIBLE: "ปั๊มจุ่ม AC",
  DC_SOLAR_SUBMERSIBLE: "ปั๊มจุ่มโซลาร์ DC",
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
  depth_from: number;
  depth_to: number;
  strata_type: string;
  lithology_name?: string;
  description?: string;
}

export function streamWellReportPdf(res: Response, well: FullWell & { driller_name?: string }, job: JobInfo) {
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
  doc.text(`กำหนดการ: ${job.scheduled_date}`);
  doc.moveDown(1);

  doc.rect(50, doc.y, 495, 70).strokeColor("#ccc").stroke();
  const statY = doc.y + 12;
  const stats: [string, string][] = [
    ["ความลึกรวม", `${well.total_depth} ม.`],
    ["อัตราไหล", `${well.water_quantity} ลบ.ม./ชม.`],
    ["ระดับน้ำคงที่", `${well.static_water_level} ม.`],
    ["ระดับน้ำสูบน้ำ", `${well.pumping_water_level} ม.`],
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
  tableHeader(doc, ["ความลึก (ม.)", "ชนิดหิน", "หมายเหตุ"], [90, 130, 275]);
  (well.strata as StrataRow[]).forEach((s) => {
    tableRow(doc, [
      `${s.depth_from}-${s.depth_to}`,
      s.lithology_name || s.strata_type,
      s.description || "-",
    ], [90, 130, 275]);
  });
  doc.moveDown(1);

  doc.font("ThaiBold").fontSize(13).fillColor("#111").text("ท่อปลอก / ท่อกรอง");
  doc.moveDown(0.3);
  tableHeader(doc, ["ความลึก (ม.)", "ชนิด", "ขนาด", "ชั้น"], [90, 150, 100, 155]);
  well.pipes.forEach((p) => {
    tableRow(doc, [
      `${p.depth_from}-${p.depth_to}`,
      PIPE_TYPE_LABEL[p.pipe_type] || p.pipe_type,
      p.pipe_size.replace("_", " ").replace("INCH", "นิ้ว"),
      p.thickness_class,
    ], [90, 150, 100, 155]);
  });
  doc.moveDown(1);

  doc.font("ThaiBold").fontSize(13).fillColor("#111").text("การติดตั้งปั๊ม");
  doc.moveDown(0.3);
  tableHeader(doc, ["ชนิด", "ยี่ห้อ", "แรงม้า", "ความลึก (ม.)"], [140, 170, 90, 95]);
  well.pumps.forEach((p) => {
    tableRow(doc, [
      PUMP_TYPE_LABEL[p.pump_type] || p.pump_type,
      p.brand || "-",
      String(p.horsepower),
      String(p.installation_depth),
    ], [140, 170, 90, 95]);
  });

  if (well.notes) {
    doc.moveDown(1);
    doc.font("ThaiBold").fontSize(13).fillColor("#111").text("หมายเหตุ");
    doc.font("Thai").fontSize(10).fillColor("#444").text(well.notes);
  }

  doc.end();
}

function tableHeader(doc: PDFKit.PDFDocument, cols: string[], widths: number[]) {
  const startX = 50;
  let x = startX;
  doc.fontSize(9).fillColor("#888").font("ThaiBold");
  cols.forEach((c, i) => { doc.text(c, x, doc.y, { width: widths[i], continued: false }); x += widths[i]; });
  doc.moveDown(0.4);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor("#ddd").stroke();
  doc.moveDown(0.3);
}

function tableRow(doc: PDFKit.PDFDocument, cols: string[], widths: number[]) {
  const startX = 50;
  const rowY = doc.y;
  let x = startX;
  doc.fontSize(9).fillColor("#222").font("Thai");
  cols.forEach((c, i) => { doc.text(c, x, rowY, { width: widths[i] }); x += widths[i]; });
  doc.moveDown(0.5);
}
