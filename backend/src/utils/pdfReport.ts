import path from "path";
import PDFDocument from "pdfkit";
import { Response } from "express";
import { FullWell } from "../types";

const FONT_DIR = path.join(__dirname, "..", "..", "fonts");
const FONT_REGULAR = path.join(FONT_DIR, "Sarabun-Regular.ttf");
const FONT_BOLD = path.join(FONT_DIR, "Sarabun-Bold.ttf");

const MARGIN = 50;
const PAGE_CONTENT_WIDTH = 495; // A4 (595.28pt) minus left+right margins
const FOOTER_RESERVE = 34;

const COLORS = {
  primary: "#1F5C61",
  primaryLight: "#EAF3F2",
  text: "#111827",
  muted: "#6B7280",
  border: "#E2E8F0",
  headerBg: "#F1F5F9",
  zebra: "#F8FAFC",
};

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

const DRILLING_METHOD_LABEL: Record<string, string> = {
  ROTARY: "โรตารี",
  DTH: "DTH",
  CABLE_TOOL: "คันกระแทก",
  AUGER: "สว่านเกลียว",
  JETTING: "เจ็ตติ้ง",
  OTHER: "อื่นๆ",
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

interface Column {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
}

export function streamWellReportPdf(res: Response, well: FullWell, job: JobInfo) {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, autoFirstPage: true, bufferPages: true });
  const isAttachment = (res as any).req?.query?.download === "1" || (res as any).req?.query?.download === "true";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${isAttachment ? "attachment" : "inline"}; filename="well-report-${well.well_id}.pdf"`);
  doc.pipe(res);

  doc.registerFont("Thai", FONT_REGULAR);
  doc.registerFont("ThaiBold", FONT_BOLD);

  // ทุกหน้าถัดจากหน้าแรกจะมีหัวเรื่องย่อกำกับไว้ เผื่อพิมพ์แยกหน้าแล้วยังรู้ว่าเป็นรายงานของบ่อไหน
  doc.on("pageAdded", () => {
    doc.font("ThaiBold").fontSize(10).fillColor(COLORS.primary)
      .text(`รายงานบ่อ #${well.well_id}  ·  ${job.customer_name || ""}`, MARGIN, doc.y, { width: PAGE_CONTENT_WIDTH });
    doc.moveDown(0.3);
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + PAGE_CONTENT_WIDTH, doc.y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.moveDown(0.6);
  });

  function ensureSpace(needed: number, onNewPage?: () => void) {
    const bottom = doc.page.height - doc.page.margins.bottom - FOOTER_RESERVE;
    if (doc.y + needed > bottom) {
      doc.addPage();
      if (onNewPage) onNewPage();
    }
  }

  function sectionHeading(title: string) {
    ensureSpace(34);
    doc.font("ThaiBold").fontSize(12).fillColor(COLORS.text).text(title, MARGIN, doc.y);
    const lineY = doc.y + 2;
    doc.moveTo(MARGIN, lineY).lineTo(MARGIN + PAGE_CONTENT_WIDTH, lineY).strokeColor(COLORS.primary).lineWidth(1.5).stroke();
    doc.y = lineY + 10;
  }

  function tableHeaderRow(columns: Column[]) {
    ensureSpace(26);
    const y = doc.y;
    doc.rect(MARGIN, y, PAGE_CONTENT_WIDTH, 22).fill(COLORS.headerBg);
    let x = MARGIN;
    columns.forEach((col) => {
      doc.font("ThaiBold").fontSize(9).fillColor(COLORS.muted)
        .text(col.label, x + 6, y + 6, { width: col.width - 10, align: col.align || "left" });
      x += col.width;
    });
    doc.y = y + 22;
  }

  function dataTable(title: string, columns: Column[], rows: string[][], emptyText = "ยังไม่มีข้อมูลบันทึกไว้") {
    sectionHeading(title);
    tableHeaderRow(columns);

    if (!rows.length) {
      ensureSpace(26);
      const y = doc.y;
      doc.rect(MARGIN, y, PAGE_CONTENT_WIDTH, 26).strokeColor(COLORS.border).lineWidth(0.5).stroke();
      doc.font("Thai").fontSize(9).fillColor(COLORS.muted)
        .text(emptyText, MARGIN + 6, y + 8, { width: PAGE_CONTENT_WIDTH - 12 });
      doc.y = y + 26;
      doc.moveDown(1.1);
      return;
    }

    rows.forEach((cells, idx) => {
      // วัดความสูงจริงของแต่ละช่อง (รวมกรณีข้อความยาวจนขึ้นบรรทัดใหม่) แล้วใช้ค่าสูงสุด
      // เป็นความสูงของทั้งแถว — ป้องกันข้อความช่องถัดไปทับซ้อนแถวก่อนหน้าเมื่อมีข้อความยาว
      doc.font("Thai").fontSize(9);
      const cellHeights = cells.map((c, i) =>
        doc.heightOfString(c || "-", { width: columns[i].width - 10 })
      );
      const rowHeight = Math.max(...cellHeights, 16) + 10;

      ensureSpace(rowHeight, () => tableHeaderRow(columns));
      const y = doc.y;

      if (idx % 2 === 1) {
        doc.rect(MARGIN, y, PAGE_CONTENT_WIDTH, rowHeight).fill(COLORS.zebra);
      }

      let x = MARGIN;
      cells.forEach((c, i) => {
        doc.font("Thai").fontSize(9).fillColor(COLORS.text)
          .text(c || "-", x + 6, y + 5, { width: columns[i].width - 10, align: columns[i].align || "left" });
        x += columns[i].width;
      });

      doc.y = y + rowHeight;
      doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + PAGE_CONTENT_WIDTH, doc.y).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    });

    doc.moveDown(1.1);
  }

  // ============================================================
  // Header band
  // ============================================================
  doc.rect(0, 0, doc.page.width, 86).fill(COLORS.primary);
  doc.fillColor("#FFFFFF").font("ThaiBold").fontSize(20).text("รายงานผลการเจาะบ่อบาดาล", MARGIN, 26);
  doc.font("Thai").fontSize(10).fillColor("#DCEAE8")
    .text(`รหัสบ่อ #${well.well_id}  ·  ออกรายงานวันที่ ${new Date().toISOString().slice(0, 10)}`, MARGIN, 54);
  doc.y = 106;

  // ============================================================
  // Job / customer info card
  // ============================================================
  const infoTop = doc.y;
  const infoRows: [string, string][] = [
    ["งาน", job.job_title || "-"],
    ["ที่อยู่ไซต์งาน", job.site_address || "-"],
    ["ลูกค้า", job.customer_name || "-"],
    ["ผู้เจาะ", job.driller_name || "-"],
    ["วันที่เจาะ", job.scheduled_date || "-"],
  ];
  doc.font("Thai").fontSize(9);
  const infoHeight = infoRows.reduce((sum, [, v]) => sum + doc.heightOfString(v, { width: 380 }) + 6, 0) + 12;
  doc.rect(MARGIN, infoTop, PAGE_CONTENT_WIDTH, infoHeight).fillAndStroke(COLORS.primaryLight, COLORS.border);
  let infoY = infoTop + 8;
  infoRows.forEach(([label, value]) => {
    doc.font("ThaiBold").fontSize(9).fillColor(COLORS.primary).text(label, MARGIN + 10, infoY, { width: 90 });
    doc.font("Thai").fontSize(9).fillColor(COLORS.text).text(value, MARGIN + 105, infoY, { width: 380 });
    infoY = doc.y + 6;
  });
  doc.y = infoTop + infoHeight + 14;

  // ============================================================
  // Key stats grid
  // ============================================================
  const statsTop = doc.y;
  const statBoxH = 60;
  doc.rect(MARGIN, statsTop, PAGE_CONTENT_WIDTH, statBoxH).strokeColor(COLORS.border).lineWidth(0.5).stroke();
  doc.moveTo(MARGIN + PAGE_CONTENT_WIDTH / 2, statsTop).lineTo(MARGIN + PAGE_CONTENT_WIDTH / 2, statsTop + statBoxH)
    .strokeColor(COLORS.border).lineWidth(0.5).stroke();
  doc.moveTo(MARGIN, statsTop + statBoxH / 2).lineTo(MARGIN + PAGE_CONTENT_WIDTH, statsTop + statBoxH / 2)
    .strokeColor(COLORS.border).lineWidth(0.5).stroke();

  const stats: [string, string][] = [
    ["ความลึกรวม", well.total_depth_m != null ? `${well.total_depth_m} ม.` : "-"],
    ["ปริมาณน้ำ", well.water_quantity_m3hr != null ? `${well.water_quantity_m3hr} ลบ.ม./ชม.` : "-"],
    ["ความลึกที่ต้องการ", well.requested_depth_m != null ? `${well.requested_depth_m} ม.` : "-"],
    ["วิธีการเจาะ", well.drilling_method ? DRILLING_METHOD_LABEL[well.drilling_method] || well.drilling_method : "-"],
  ];
  stats.forEach(([label, value], i) => {
    const x = MARGIN + 16 + (i % 2) * (PAGE_CONTENT_WIDTH / 2);
    const y = statsTop + 10 + Math.floor(i / 2) * (statBoxH / 2);
    doc.font("Thai").fontSize(8).fillColor(COLORS.muted).text(label, x, y);
    doc.font("ThaiBold").fontSize(13).fillColor(COLORS.text).text(value, x, y + 12);
  });
  doc.y = statsTop + statBoxH + 20;

  // ============================================================
  // Data tables
  // ============================================================
  dataTable(
    "บันทึกชั้นดิน / ชั้นหิน",
    [
      { label: "ความลึก (ม.)", width: 90 },
      { label: "ชนิดหิน", width: 150 },
      { label: "หมายเหตุ", width: 255 },
    ],
    (well.strata as StrataRow[] || []).map((s) => {
      const litho = s.lithology_type
        ? LITHOLOGY_TYPE_LABEL[s.lithology_type] || s.lithology_name || "-"
        : s.lithology_name || "-";
      return [`${s.depth_from_m}-${s.depth_to_m}`, litho, s.description || "-"];
    })
  );

  dataTable(
    "ท่อปลอก / ท่อกรอง",
    [
      { label: "ความลึก (ม.)", width: 90 },
      { label: "วัสดุ/ชนิด", width: 150 },
      { label: "ขนาด", width: 100 },
      { label: "จำนวน", width: 155, align: "right" },
    ],
    (well.pipes || []).map((p) => [
      `${p.depth_from_m}-${p.depth_to_m}`,
      `${MATERIAL_LABEL[p.material || "OTHER"] || "-"} ${PIPE_TYPE_LABEL[p.pipe_type || ""] || ""}`.trim() || "-",
      p.size_mm != null ? `${p.size_mm} มม.` : "-",
      String(p.quantity),
    ])
  );

  dataTable(
    "การติดตั้งปั๊ม",
    [
      { label: "ชนิด", width: 120 },
      { label: "ยี่ห้อ/รุ่น", width: 190 },
      { label: "แรงม้า", width: 90, align: "right" },
      { label: "ความลึก (ม.)", width: 95, align: "right" },
    ],
    (well.pumps || []).map((p) => [
      PUMP_TYPE_LABEL[p.pump_type || "OTHER"] || "-",
      [p.brand, p.pump_model].filter(Boolean).join(" ") || "-",
      p.horsepower != null ? String(p.horsepower) : "-",
      p.installation_depth_m != null ? String(p.installation_depth_m) : "-",
    ])
  );

  dataTable(
    "ตู้คอนโทรล",
    [
      { label: "ยี่ห้อ", width: 120 },
      { label: "รุ่น", width: 170 },
      { label: "พิกัด", width: 90 },
      { label: "ระบบป้องกัน", width: 115 },
    ],
    (well.control_boxes || []).map((c) => [
      c.brand || "-",
      c.model || "-",
      c.capacity || "-",
      c.protection_type ? PROTECTION_TYPE_LABEL[c.protection_type] || c.protection_type : (c.voltage || "-"),
    ])
  );

  // ============================================================
  // Notes
  // ============================================================
  if (well.notes) {
    sectionHeading("หมายเหตุ");
    doc.font("Thai").fontSize(9);
    const noteHeight = doc.heightOfString(well.notes, { width: PAGE_CONTENT_WIDTH - 20 }) + 16;
    ensureSpace(noteHeight);
    const y = doc.y;
    doc.rect(MARGIN, y, PAGE_CONTENT_WIDTH, noteHeight).fillAndStroke(COLORS.zebra, COLORS.border);
    doc.font("Thai").fontSize(9).fillColor(COLORS.text).text(well.notes, MARGIN + 10, y + 8, { width: PAGE_CONTENT_WIDTH - 20 });
    doc.y = y + noteHeight;
  }

  // ============================================================
  // Footer — page numbers on every page
  // ============================================================
  // ต้องปิด listener "pageAdded" และดัน bottom margin ลงเป็น 0 ชั่วคราวก่อนเขียน footer
  // เพราะ doc.text() ของ pdfkit เช็คระยะขอบล่างเสมอ — เขียนข้อความใกล้ขอบล่างสุดของหน้า
  // (ในตำแหน่ง footer) จะโดนตีความว่าเนื้อหาล้นหน้า แล้วสั่ง addPage() เพิ่มเองอัตโนมัติ
  // ซึ่งจะไปสั่ง pageAdded ซ้ำ วาด header ซ้อนเป็นหน้าว่างๆ ไปเรื่อยๆ
  doc.removeAllListeners("pageAdded");
  const savedBottomMargin = doc.page.margins.bottom;
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    const bottom = doc.page.height - 34;
    doc.moveTo(MARGIN, bottom).lineTo(MARGIN + PAGE_CONTENT_WIDTH, bottom).strokeColor(COLORS.border).lineWidth(0.5).stroke();
    doc.font("Thai").fontSize(8).fillColor(COLORS.muted)
      .text("ระบบจัดการบ่อบาดาล", MARGIN, bottom + 8, { width: 300, lineBreak: false });
    doc.font("Thai").fontSize(8).fillColor(COLORS.muted)
      .text(`หน้า ${i - range.start + 1} จาก ${range.count}`, MARGIN, bottom + 8, { width: PAGE_CONTENT_WIDTH, align: "right", lineBreak: false });
    doc.page.margins.bottom = savedBottomMargin;
  }

  doc.end();
}
