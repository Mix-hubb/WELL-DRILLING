import "dotenv/config";
import { pool } from "../config/db";
import { RowDataPacket } from "mysql2";

// ============================================================
// Migration: ฟีเจอร์แคตตาล็อกปั๊มซับเมอร์ส
//   1) เพิ่มคอลัมน์ repair_records.pump (JSON) — ปั๊มที่เปลี่ยนระหว่างซ่อม
//   2) สร้างตาราง pump_catalog_models (Franklin Electric + TORQUE)
//   3) ใส่ข้อมูลแคตตาล็อก (ถ้ายังว่าง)
// รันซ้ำได้ (idempotent) — ใช้: npm run migrate:pump-catalog
// ============================================================

type CatalogRow = [
  string, string | null, string, string | null, string | null, string | null,
  string | null, string | null, string | null, string | null, string | null,
  string | null, number | null, string | null, number
];

const CATALOG: CatalogRow[] = [
  // brand, series, model, bore_size, flow_rate, motor_power, phase, discharge_size, impeller_stages, max_head_m, material, features, reference_price, notes, sort_order
  // ===== Franklin Electric =====
  ["FRANKLIN", "3200 Series", "3200 Series (4\")", "4", "5/7/10/15/25 gpm", "0.5-10 HP", "1/3 เฟส", "1.25\" NPT", "6-44 สเตจ", "สูงสุด ~500 ม.", "สแตนเลส + เทอร์โมพลาสติก", "ขนาดกะทัดรัด เส้นผ่านศูนย์กลาง 3.75\" รวมสายไฟ", null, null, 1],
  ["FRANKLIN", "4400 Tri Seal Series", "4400 Tri Seal Series (4\")", "4", "18/25/30/45/60/70 LPM", "0.5-7.5 HP", "1/3 เฟส", "2\" BSP", "หลายสเตจ", "สูงสุด ~430 ม.", "AISI 304", "ระบบ Tri-Seal ป้องกันทราย ใบพัดแบบ floating", null, null, 2],
  ["FRANKLIN", "4400 High Capacity", "4400 High Capacity (4\")", "4", "100/150/200/270 LPM", "0.75-7.5 HP", "1/3 เฟส", "2\" BSP", "หลายสเตจ", "สูงสุด ~300 ม.", "สแตนเลส", "อัตราการไหลสูง เหมาะสำหรับบ่อ 4 นิ้ว", null, null, 3],
  ["FRANKLIN", "6\" Tri Seal High Capacity", "6\" Tri Seal High Capacity", "6", "50/75/100/125 gpm", "1.5-40 HP", "1/3 เฟส", "2\" NPT", "3-44 สเตจ", "สูงสุด ~366 ม. (1,200 ft)", "สแตนเลส", "สำหรับงานอัตราการไหลสูง", null, null, 4],
  ["FRANKLIN", "SSI Series", "SSI Series (6\"/8\"/10\")", "6/8/10", "6-270 m³/h", "0.55-55 kW", "1/3 เฟส", "Rp 2.5\"/3\"/4\"/5\"", "1-42 สเตจ", "สูงสุด 377 ม.", "AISI 304", "ปั๊ม turbine แบบ stamped stainless steel ซ่อมบำรุงได้", null, null, 5],
  ["FRANKLIN", "SR Series", "SR Series (6\"/8\")", "6/8", "สูงสุด 80 m³/h (50Hz)", "สูงสุด 400 kW", "3 เฟส", "Rp 2\"-4\"", "หลายสเตจ", "สูงสุด 700 ม. (70 Bar)", "AISI 304/316/904L", "รองรับอุณหภูมิสูงสุด 90°C มีเวอร์ชัน high pressure", null, null, 6],
  ["FRANKLIN", "FS Series", "FS Series (8\"-16\")", "8/10/12/14/16", "100-1,000 m³/h", "สูงสุด 400 kW", "3 เฟส", "หน้าแปลน (Flanged)", "หลายสเตจ", "สูงสุด 700 ม.", "AISI 316", "งานอุตสาหกรรมปริมาณน้ำมาก", null, null, 7],
  ["FRANKLIN", "J-Class", "J-Class (4\")", "4", "5/7/10/15/20/25 gpm", "0.5-5 HP", "1/3 เฟส", "1.25\" NPT", "หลายสเตจ", "สูงสุด ~1,600 ft", "สแตนเลส + เทอร์โมพลาสติก", "ซีรีส์เก่าที่ทนทาน มีแคตตาล็อกครบรุ่น", null, null, 8],
  ["FRANKLIN", "High Capacity 4\"", "100FH (High Capacity 4\")", "4", "100 LPM", "0.75-7.5 HP", "1/3 เฟส", "2\"", "หลายสเตจ", "สูงสุด ~250 ม.", "สแตนเลส", null, null, null, 9],
  ["FRANKLIN", "J-Class 4\"", "100FA2S4-PEXB (J-Class)", "4", null, "2 HP (1,500 W)", "1 เฟส 220V", "2\"", "12 ใบ", null, "สแตนเลส", null, 26490, null, 10],
  ["FRANKLIN", "High Capacity 4\" (หัวปั๊ม)", "12AD26-75 (หัวปั๊ม)", "4", "160-260 LPM", "7.5 HP", null, "1.5\"", "26 ใบ", "111-47 ม.", "สแตนเลส", null, 10560, null, 11],
  ["FRANKLIN", "High Capacity 4\"", "High Capacity 4\" 2HP (1 เฟส)", "4", null, "2 HP", "1 เฟส", null, null, "~200 ม.", null, null, null, null, 12],
  ["FRANKLIN", "High Capacity 4\"", "High Capacity 4\" 2HP (3 เฟส)", "4", null, "2 HP", "3 เฟส", null, null, "~200 ม.", null, null, 31574, null, 13],
  ["FRANKLIN", "High Capacity 4\"", "High Capacity 4\" 3HP (1 เฟส)", "4", null, "3 HP", "1 เฟส", null, null, "~250 ม.", null, null, 22950, null, 14],
  ["FRANKLIN", "High Capacity 4\"", "High Capacity 4\" 3HP (3 เฟส)", "4", null, "3 HP", "3 เฟส", null, null, "~250 ม.", null, null, 23450, null, 15],
  ["FRANKLIN", "มอเตอร์ 6\"", "Y DELTA มอเตอร์ 6\" 20HP", "6", null, "20 HP", "3 เฟส 380V", null, null, null, null, "มอเตอร์ปั๊มขนาด 6 นิ้ว แบบ Y-Delta", 105800, null, 16],

  // ===== TORQUE (นำเข้าอิตาลี โดย SOIHA INTERGROUP) =====
  ["TORQUE", "2BM Series", "2BM Series (3\")", "3", "50 LPM", "0.5-2 HP", "1/3 เฟส", null, "11-37 ใบ", "สูงสุด 140 ม.", "AISI 304", null, null, "ขนาดบ่อ 3\"/4\"/6\" | กำลังรวม 0.33-20 HP | ใบพัด 3-40 | อัตราไหล 50-1,200 LPM | AC 1 เฟส 220V / 3 เฟส 380V | ทนไฟ 1 เฟส 170-240V / 3 เฟส 350-380V | กันน้ำ IP68 Class F (155°C) | แรงกดเพลา 6,500 N สตาร์ท 30 ครั้ง/ชม. | รับประกัน 1 ปี (PRO SERIES 2 ปี) | มาตรฐาน FDA NEMA KTW ACS WRAS", 1],
  ["TORQUE", "2BH/2BM Series", "2BH/2BM Series (4\")", "4", "2 m³/h", "0.33-1.5 HP", "1/3 เฟส", null, "หลายสเตจ", null, "AISI 304", null, null, null, 2],
  ["TORQUE", "4BH/4BM Series", "4BH/4BM Series (4\")", "4", "4 m³/h", "1-3 HP", "1/3 เฟส", null, "หลายสเตจ", null, "AISI 304", null, null, null, 3],
  ["TORQUE", "6BH/6BM Series", "6BH/6BM Series (4\")", "4", "6 m³/h", "1.5-5 HP", "1/3 เฟส", null, "หลายสเตจ", null, "AISI 304", null, null, null, 4],
  ["TORQUE", "8BH/8BM Series", "8BH/8BM Series (4\")", "4", "8 m³/h", "3-7.5 HP", "1/3 เฟส", null, "หลายสเตจ", null, "AISI 304", null, null, null, 5],
  ["TORQUE", "12/16 BH Series", "12/16 BH Series (4\")", "4", "12/16 m³/h", "5-10 HP", "1/3 เฟส", null, "หลายสเตจ", null, "AISI 304", null, null, null, 6],
  ["TORQUE", "14SP Series", "14SP Series (4\")", "4", "14 m³/h", "7.5-10 HP", "1/3 เฟส", null, "หลายสเตจ", null, "AISI 304", null, null, null, 7],
  ["TORQUE", "4BG Series", "4BG Series (3.5\")", "3.5", "4 m³/h", "1-3 HP", "1/3 เฟส", null, "หลายสเตจ", null, "AISI 304", null, null, null, 8],
  ["TORQUE", "30BP Series", "30BP Series (6\")", "6", "สูงสุด 1,200 LPM", "5.5-20 HP", "1/3 เฟส", "3\"", "3-5 ใบ", "สูงสุด 70 ม.", "AISI 304", null, null, null, 9],
  ["TORQUE", "2BM Series", "TQ-SP 2BM16-3/S", "3", null, "0.75 HP (0.55 kW)", "1 เฟส 220V", "1.25\"", "16 ใบ", "64 ม.", "AISI 304", null, 10406, "เหมาะสำหรับบ่อลึก 37-60 ม.", 10],
  ["TORQUE", "2BM Series", "TQ-SP 2BM20-4/ST", "4", null, "1.5 HP (1.1 kW)", "3 เฟส 220V", "1.5\"", "20 ใบ", "130 ม.", "AISI 304", null, 13915, "เหมาะสำหรับบ่อลึก 53-119 ม.", 11],
  ["TORQUE", "4BM Series", "TQ-SP 4BM09-4", "4", null, "1 HP", null, null, "9 ใบ", null, "AISI 304", null, 14190, null, 12],
  ["TORQUE", "4BM Series", "TQ-SP 4BM14-4/S", "4", null, "1.5 HP (1.1 kW)", "1 เฟส 220V", "1.5\"", "14 ใบ", "84 ม.", "AISI 304", null, 13623, "ราคาโดยประมาณ ~11,800-13,623 บาท", 13],
  ["TORQUE", "4BM Series", "TQ-SP 4BM14-4", "4", null, "1.5 HP (1.1 kW)", "3 เฟส 220V", "1.5\"", "14 ใบ", null, "AISI 304", null, null, null, 14],
  ["TORQUE", "6BM Series", "TQ-SP 6BM10-4", "4", null, "1.5 HP", null, "2\"", "10 ใบ", null, "AISI 304", null, null, null, 15],
  ["TORQUE", "30BP Series", "TQ-SP 30BP03-6", "6", null, "3 HP (2.2 kW)", "3 เฟส 220V", "3\"", "3 ใบ", "39 ม.", "AISI 304", null, null, null, 16],
  ["TORQUE", "ปั๊มจุ่ม", "TQ-SP-M120", null, "91 LPM", "100 W", "1 เฟส 220V", "3/4\" - 1\"", null, "6.5 ม.", null, "ปั๊มจุ่มระบายน้ำ", null, null, 17],
  ["TORQUE", "ปั๊มจุ่ม", "TQ-SP-M450", null, "250 LPM", "450 W", "1 เฟส 220V", "2\"", null, "12 ม.", null, "ปั๊มจุ่มระบายน้ำ", null, null, 18],
  ["TORQUE", "ปั๊มจุ่ม TDS", "TQ-SP-TDS180", null, "120 LPM", "300 W (มอเตอร์ 180 W)", "1 เฟส 220V", "1\"", null, "6 ม.", null, "ปั๊มจุ่มระบายน้ำ", null, "2,860 rpm", 19],
  ["TORQUE", "ปั๊มจุ่ม TDS", "TQ-SP-TDS550F", null, "300 LPM", "800 W (มอเตอร์ 550 W)", "1 เฟส 220V", "2\"", null, "10 ม.", null, "ปั๊มจุ่มระบายน้ำ", null, "2,860 rpm", 20],
  ["TORQUE", "ปั๊มจุ่ม TDS", "TQ-SP-TDS750", null, "350 LPM", "1,000 W (มอเตอร์ 750 W)", "1 เฟส 220V", "2\"", null, "12 ม.", null, "ปั๊มจุ่มระบายน้ำ", null, "2,860 rpm", 21],
  ["TORQUE", "ปั๊มโซลาร์", "TQ-SP-4DC0806-AD-A11/S", "4", null, "1.5 HP (1,100 W)", "1 เฟส 220V / DC", "2\"", "6 ใบ", "75 ม.", "AISI 304", "ปั๊มโซลาร์ รองรับไฟ AC/DC ใช้ร่วมกับโซลาร์เซลล์", null, null, 22],
];

async function main() {
  // 1) repair_records.pump
  const [cols] = await pool.query<RowDataPacket[]>(
    "SHOW COLUMNS FROM repair_records LIKE 'pump'"
  );
  if (!cols.length) {
    await pool.query("ALTER TABLE repair_records ADD COLUMN pump JSON NULL AFTER parts");
    console.log("✓ เพิ่มคอลัมน์ repair_records.pump (JSON)");
  } else {
    console.log("- repair_records.pump มีอยู่แล้ว (ข้าม)");
  }

  // 2) ตาราง pump_catalog_models
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pump_catalog_models (
      model_id          INT UNSIGNED       NOT NULL AUTO_INCREMENT,
      brand             VARCHAR(50)        NOT NULL COMMENT 'ยี่ห้อ (FRANKLIN / TORQUE / ...)',
      series            VARCHAR(120)       NULL COMMENT 'ชื่อซีรีส์ เช่น 4" Tri Seal',
      model             VARCHAR(150)       NOT NULL COMMENT 'รุ่น/รหัสรุ่น',
      bore_size         VARCHAR(20)        NULL COMMENT 'ขนาดบ่อ (นิ้ว)',
      flow_rate         VARCHAR(80)        NULL COMMENT 'อัตราการไหล (LPM/gpm/m³/h)',
      motor_power       VARCHAR(80)        NULL COMMENT 'กำลังมอเตอร์ (HP / kW)',
      phase             VARCHAR(30)        NULL COMMENT 'เฟส / แรงดัน',
      discharge_size    VARCHAR(50)        NULL COMMENT 'ขนาดท่อจ่าย',
      impeller_stages   VARCHAR(50)        NULL COMMENT 'จำนวนใบพัด / สเตจ',
      max_head_m        VARCHAR(50)        NULL COMMENT 'เฮดส่งสูงสุด (ม.)',
      material          VARCHAR(120)       NULL COMMENT 'วัสดุ',
      features          VARCHAR(500)       NULL COMMENT 'จุดเด่น',
      reference_price   DECIMAL(12,2)      NULL COMMENT 'ราคาอ้างอิง (บาท)',
      notes             TEXT               NULL,
      sort_order        INT                NOT NULL DEFAULT 0,
      is_active         TINYINT(1)         NOT NULL DEFAULT 1,
      created_at        TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at        TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (model_id),
      INDEX idx_pump_catalog_brand (brand, is_active, sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log("✓ ตาราง pump_catalog_models พร้อมใช้งาน");

  // 3) ข้อมูลแคตตาล็อก (ถ้ายังว่าง)
  const [cnt] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS c FROM pump_catalog_models"
  );
  if (Number(cnt[0].c) > 0) {
    console.log(`- มีข้อมูลแคตตาล็อกอยู่แล้ว ${cnt[0].c} รายการ (ข้ามการเพิ่ม)`);
  } else {
    const placeholders = CATALOG.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(",\n");
    const params: any[] = [];
    for (const r of CATALOG) params.push(...r);
    await pool.query(
      `INSERT INTO pump_catalog_models
        (brand, series, model, bore_size, flow_rate, motor_power, phase, discharge_size,
         impeller_stages, max_head_m, material, features, reference_price, notes, sort_order)
       VALUES ${placeholders}`,
      params
    );
    console.log(`✓ เพิ่มแคตตาล็อกปั๊ม ${CATALOG.length} รายการ (Franklin Electric + TORQUE)`);
  }

  await pool.end();
  console.log("Migration เสร็จสมบูรณ์");
}

main().catch((err) => {
  console.error("Migration ล้มเหลว:", err);
  process.exit(1);
});
