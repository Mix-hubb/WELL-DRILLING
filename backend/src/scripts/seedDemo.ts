import "dotenv/config";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// ============================================================
// ข้อมูลตัวอย่าง (Demo Seed) — รันซ้ำได้ (idempotent)
// ใช้: npm run seed
// ============================================================

const DEMO_PHONE = "0811112222";

async function main() {
  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT customer_id FROM customers WHERE phone = ? LIMIT 1", [DEMO_PHONE]
  );
  if (existing.length) {
    console.log("มีข้อมูลตัวอย่างอยู่แล้ว — ข้ามการเพิ่ม");
    await pool.end();
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ---------- ลูกค้า ----------
    const custIds: number[] = [];
    const customers = [
      { name: "สมชาย ใจดี",    phone: "0811112222", address: "88 หมู่ 3 ต.บ้านโป่ง อ.เมือง จ.ราชบุรี 70000" },
      { name: "มาลี ทองสุข",   phone: "0822223333", address: "12 ถ.แถวน้ำ ต.ท่ามะกา จ.กาญจนบุรี 71120" },
      { name: "ประเสริฐ วงษ์มั่น", phone: "0833334444", address: "5/1 หมู่ 6 ต.หนองปลิง จ.กำแพงเพชร 62000" },
      { name: "น้ำทิพย์ สุขสันต์", phone: "0844445555", address: "99 ซ.สบายใจ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000" },
    ];
    for (const c of customers) {
      const [r] = await conn.query<ResultSetHeader>(
        "INSERT INTO customers (customer_name, phone, address) VALUES (?, ?, ?)",
        [c.name, c.phone, c.address]
      );
      custIds.push(r.insertId);
    }
    const [สมชาย, มาลี, ประเสริฐ, น้ำทิพย์] = custIds;

    // ---------- บ่อบาดาล ----------
    const wellIds: number[] = [];
    const wells = [
      {
        customer_id: สมชาย, well_name: "บ่อสวนหลังบ้าน", address: "88 หมู่ 3 ต.บ้านโป่ง อ.เมือง จ.ราชบุรี",
        total_depth_m: 60, requested_depth_m: 60, drilling_method: "ROTARY", formation_water_type: "FRESH",
        water_quantity_m3hr: 5.5, yield_lpm: 92, static_water_level_m: 12.5, pumping_water_level_m: 25,
        driller_name: "ช่างเอก", completion_date: "2026-01-15", result: "SUCCESS",
        notes: "น้ำดี ใช้ทำการเกษตร + อุปโภค",
      },
      {
        customer_id: สมชาย, well_name: "บ่อหน้าไร่", address: "45 ไร่ ต.บ้านโป่ง จ.ราชบุรี",
        total_depth_m: 40, requested_depth_m: 40, drilling_method: "DTH", formation_water_type: "BRACKISH",
        water_quantity_m3hr: 2.0, yield_lpm: 33, static_water_level_m: 18, pumping_water_level_m: 30,
        driller_name: "ช่างเอก", completion_date: "2023-06-01", result: "SUCCESS",
        notes: "น้ำกร่อย ใช้รดน้ำต้นไม้ได้",
      },
      {
        customer_id: มาลี, well_name: "บ่อน้ำดื่มบ้าน", address: "12 ถ.แถวน้ำ ต.ท่ามะกา จ.กาญจนบุรี",
        total_depth_m: 30, requested_depth_m: 30, drilling_method: "ROTARY", formation_water_type: "FRESH",
        water_quantity_m3hr: 3.0, yield_lpm: 50, static_water_level_m: 8, pumping_water_level_m: 20,
        driller_name: "ช่างเอก", completion_date: "2026-06-20", result: "SUCCESS", notes: "",
      },
      {
        customer_id: น้ำทิพย์, well_name: "บ่อหลัก", address: "99 ซ.สบายใจ ต.ในเมือง จ.ขอนแก่น",
        total_depth_m: 25, requested_depth_m: 25, drilling_method: "AUGER", formation_water_type: "FRESH",
        water_quantity_m3hr: 1.8, yield_lpm: 30, static_water_level_m: 6, pumping_water_level_m: 16,
        driller_name: "ช่างมนต์", completion_date: "2025-05-01", result: "SUCCESS", notes: "",
      },
    ];
    for (const w of wells) {
      const [r] = await conn.query<ResultSetHeader>(
        `INSERT INTO wells
          (customer_id, well_name, address, total_depth_m, requested_depth_m, drilling_method,
           formation_water_type, water_quantity_m3hr, yield_lpm, static_water_level_m,
           pumping_water_level_m, driller_name, completion_date, result, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [w.customer_id, w.well_name, w.address, w.total_depth_m, w.requested_depth_m, w.drilling_method,
         w.formation_water_type, w.water_quantity_m3hr, w.yield_lpm, w.static_water_level_m,
         w.pumping_water_level_m, w.driller_name, w.completion_date, w.result, w.notes || null]
      );
      wellIds.push(r.insertId);
    }
    const [W1, W2, W3, W4] = wellIds;

    // ชั้นดิน (W1)
    const strataW1 = [
      [0, 4, "ดินเหนียว", "#A0856C", "SOFT", 0, "ชั้นดินบน"],
      [4, 12, "ทรายละเอียด", "#D2B48C", "MEDIUM", 0, ""],
      [12, 25, "ทรายหยาบ + กรวด", "#8B7355", "HARD", 1, "ชั้นน้ำบาดาลหลัก"],
      [25, 48, "ดินลูกรัง", "#B87333", "HARD", 0, ""],
      [48, 60, "ทรายกรวดน้ำใต้ดิน", "#7A5C3E", "VERY_HARD", 1, "ชั้นน้ำปริมาณมาก"],
    ];
    for (const s of strataW1) {
      await conn.query<ResultSetHeader>(
        `INSERT INTO well_strata_logs (well_id, depth_from_m, depth_to_m, lithology_name, color_hex, hardness, water_bearing, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [W1, s[0], s[1], s[2], s[3], s[4], s[5], s[6]]
      );
    }

    // ท่อ (W1)
    await conn.query<ResultSetHeader>(
      `INSERT INTO well_pipes (well_id, material, pipe_type, size_mm, depth_from_m, depth_to_m, quantity, notes)
       VALUES (?, 'PVC', 'CASING', 152.4, 0, 40, 14, 'ท่อทึบ 6 นิ้ว'),
              (?, 'PVC', 'SCREEN', 152.4, 40, 60, 7, 'ท่อเซาะร่องช่วงชั้นน้ำ')`,
      [W1, W1]
    );

    // ปั๊ม (W1)
    await conn.query<ResultSetHeader>(
      `INSERT INTO well_pumps (well_id, pump_type, brand, horsepower, power_kw, impeller_stages, installation_depth_m, installed_date)
       VALUES (?, 'AC_SUBMERSIBLE', 'Hitachi', 2.0, 1.5, 12, 55, '2026-01-15')`,
      [W1]
    );

    // กล่องคอนโทรล (W1)
    await conn.query<ResultSetHeader>(
      `INSERT INTO well_control_boxes (well_id, brand, model, capacity, voltage, installed_date)
       VALUES (?, 'Mitsubishi', 'NC-2.0', '2 HP', '220V', '2026-01-15')`,
      [W1]
    );

    // ชั้นดิน + ปั๊ม (W3)
    await conn.query<ResultSetHeader>(
      `INSERT INTO well_strata_logs (well_id, depth_from_m, depth_to_m, lithology_name, color_hex, hardness, water_bearing, description)
       VALUES (?, 0, 6, 'ดินตะกอน', '#C0A080', 'SOFT', 0, ''),
              (?, 6, 30, 'ทรายกรวด', '#8B7355', 'HARD', 1, 'ชั้นน้ำจืด')`,
      [W3, W3]
    );
    await conn.query<ResultSetHeader>(
      `INSERT INTO well_pumps (well_id, pump_type, brand, horsepower, power_kw, impeller_stages, installation_depth_m, installed_date)
       VALUES (?, 'AC_SUBMERSIBLE', 'Grundfos', 1.0, 0.75, 8, 28, '2026-06-20')`,
      [W3]
    );

    // ---------- คำร้องแจ้งเจาะ ----------
    const [r1] = await conn.query<ResultSetHeader>(
      `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, status)
       VALUES (?, 'GOOGLE_FORM', 'ประเสริฐ วงษ์มั่น', '0833334444', '5/1 หมู่ 6 ต.หนองปลิง จ.กำแพงเพชร', 50, 'NEW')`,
      [ประเสริฐ]
    );
    const [r2] = await conn.query<ResultSetHeader>(
      `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, status)
       VALUES (?, 'MANUAL', 'สมชาย ใจดี', '0811112222', '88 หมู่ 3 ต.บ้านโป่ง อ.เมือง จ.ราชบุรี', 70, 'QUOTED')`,
      [สมชาย]
    );
    const [r3] = await conn.query<ResultSetHeader>(
      `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, status)
       VALUES (?, 'MANUAL', 'มาลี ทองสุข', '0822223333', '12 ถ.แถวน้ำ ต.ท่ามะกา จ.กาญจนบุรี', 30, 'ACCEPTED')`,
      [มาลี]
    );
    const [r4] = await conn.query<ResultSetHeader>(
      `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, status)
       VALUES (?, 'GOOGLE_FORM', 'สมชาย ใจดี', '0811112222', '88 หมู่ 3 ต.บ้านโป่ง', 90, 'REJECTED')`,
      [สมชาย]
    );
    const [r5] = await conn.query<ResultSetHeader>(
      `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, status)
       VALUES (?, 'LINE', 'น้ำทิพย์ สุขสันต์', '0844445555', '99 ซ.สบายใจ จ.ขอนแก่น', 20, 'CANCELLED')`,
      [น้ำทิพย์]
    );

    // ใบราคาเจาะ (R2)
    await conn.query<ResultSetHeader>(
      `INSERT INTO quotations (kind, drilling_request_id, price, status, notes)
       VALUES ('DRILLING', ?, 55000, 'PENDING', 'รวมท่อ PVC 6 นิ้ว + ปั๊ม 2 HP + ค่าเจาะ')`,
      [r2.insertId]
    );

    // ---------- คิวงานเจาะ ----------
    const [j1] = await conn.query<ResultSetHeader>(
      `INSERT INTO drilling_jobs (request_id, customer_id, status, job_title, site_address, province, district, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, 'QUEUED', 'เจาะบ่อใหม่บ้านคุณมาลี', '12 ถ.แถวน้ำ ต.ท่ามะกา', 'กาญจนบุรี', 'ท่ามะกา', 'drill-demo-queued', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [r3.insertId, มาลี]
    );
    const [j2] = await conn.query<ResultSetHeader>(
      `INSERT INTO drilling_jobs (request_id, customer_id, status, job_title, site_address, province, district, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, 'DRILLING', 'เจาะบ่อสวนหลังบ้าน', '88 หมู่ 3 ต.บ้านโป่ง', 'ราชบุรี', 'เมืองราชบุรี', 'drill-demo-drilling', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [r2.insertId, สมชาย]
    );
    const [j3] = await conn.query<ResultSetHeader>(
      `INSERT INTO drilling_jobs (request_id, customer_id, well_id, status, result, job_title, site_address, province, district, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, ?, 'SUCCESS', 'SUCCESS', 'เจาะบ่อสวนหลังบ้าน (เสร็จ)', '88 หมู่ 3 ต.บ้านโป่ง', 'ราชบุรี', 'เมืองราชบุรี', 'drill-demo-success', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [null, สมชาย, W1]
    );
    const [j4] = await conn.query<ResultSetHeader>(
      `INSERT INTO drilling_jobs (request_id, customer_id, status, result, failure_reason, job_title, site_address, province, district, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, 'FAILED', 'FAILED', 'ชั้นหินแข็งมาก เจาะถึง 12 ม. ไม่สามารถทะลุได้', 'เจาะบ่อไร่มาลี (ไม่สำเร็จ)', 'ไร่ 33 ต.ท่ามะกา', 'กาญจนบุรี', 'ท่ามะกา', 'drill-demo-failed', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [null, มาลี]
    );
    await conn.query<ResultSetHeader>(
      `INSERT INTO drilling_jobs (request_id, customer_id, well_id, status, result, job_title, site_address, province, district, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, ?, 'CLOSED', 'SUCCESS', 'เจาะบ่อหลัก (ปิดคิว)', '99 ซ.สบายใจ จ.ขอนแก่น', 'ขอนแก่น', 'เมืองขอนแก่น', 'drill-demo-closed', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [r5.insertId, น้ำทิพย์, W4]
    );

    // ---------- รายการแจ้งซ่อม ----------
    const [p1] = await conn.query<ResultSetHeader>(
      `INSERT INTO repair_requests (customer_id, well_id, problems, detail, scheduled_date, status, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, ?, ?, NULL, 'NEW', 'repair-demo-new', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [น้ำทิพย์, W4, JSON.stringify(["ปั๊มเสีย", "น้ำออกน้อย"]), "ปั๊มไม่ตัดอัตโนมัติเมื่อน้ำเต็มถัง"]
    );
    const [p2] = await conn.query<ResultSetHeader>(
      `INSERT INTO repair_requests (customer_id, well_id, problems, detail, scheduled_date, status, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, ?, ?, NULL, 'QUOTED', 'repair-demo-quoted', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [สมชาย, W1, JSON.stringify(["ตู้คอนโทรล/ไฟเสีย"]), "ไฟกระพริบเวลาสตาร์ทปั๊ม"]
    );
    const [p3] = await conn.query<ResultSetHeader>(
      `INSERT INTO repair_requests (customer_id, well_id, problems, detail, scheduled_date, status, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, ?, ?, NULL, 'ACCEPTED', 'repair-demo-accepted', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [สมชาย, W1, JSON.stringify(["น้ำไหลอ่อน"]), ""]
    );
    const [p4] = await conn.query<ResultSetHeader>(
      `INSERT INTO repair_requests (customer_id, well_id, problems, detail, scheduled_date, status, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL 5 DAY), 'SCHEDULED', 'repair-demo-scheduled', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [มาลี, W3, JSON.stringify(["ท่อ/บ่อทรุด"]), "เดินรอบบ่อแล้วมีเสียงโหวงบริเวณปากบ่อ"]
    );
    const [p5] = await conn.query<ResultSetHeader>(
      `INSERT INTO repair_requests (customer_id, well_id, problems, detail, scheduled_date, status, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, ?, ?, NULL, 'IN_PROGRESS', 'repair-demo-inprogress', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [สมชาย, W2, JSON.stringify(["น้ำขุ่น/น้ำมีกลิ่น"]), "น้ำมีกลิ่นเหม็นตั้งแต่หน้าฝน"]
    );
    const [p6] = await conn.query<ResultSetHeader>(
      `INSERT INTO repair_requests (customer_id, well_id, problems, detail, scheduled_date, status, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, ?, ?, NULL, 'COMPLETED', 'repair-demo-completed', DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [น้ำทิพย์, W4, JSON.stringify(["ปั๊มเสีย"]), "เปลี่ยนปั๊ม"]
    );

    // ใบราคาซ่อม (P2)
    await conn.query<ResultSetHeader>(
      `INSERT INTO quotations (kind, repair_request_id, price, status, notes)
       VALUES ('REPAIR', ?, 4500, 'PENDING', 'ค่างานตรวจเช็คตู้คอนโทรล + ค่าอะไหล่ตามจริง')`,
      [p2.insertId]
    );

    // บันทึกการซ่อม (P6)
    await conn.query<ResultSetHeader>(
      `INSERT INTO repair_records (repair_id, final_price, work_details, parts, is_warranty_claim, completed_at)
       VALUES (?, 3200,
         'เปลี่ยนคาปาซิเตอร์ 30uF + ตรวจสวิทช์ลูกลอย + ล้างถังน้ำ',
         JSON_ARRAY(
           JSON_OBJECT('name', 'คาปาซิเตอร์ 30uF', 'qty', 1, 'unit_price', 1200),
           JSON_OBJECT('name', 'ค่าแรงช่าง', 'qty', 1, 'unit_price', 1500),
           JSON_OBJECT('name', 'ค่าขนส่ง', 'qty', 1, 'unit_price', 500)
         ),
         1, '2026-08-05 14:30:00')`,
      [p6.insertId]
    );

    // ---------- log LINE ----------
    await conn.query<ResultSetHeader>(
      `INSERT INTO line_notifications (customer_id, kind, content, status) VALUES
       (?, 'QUOTE', 'ใบเสนอราคาขุดเจาะบ่อใหม่ 55,000 บาท กรุณายืนยัน', 'SENT'),
       (?, 'QUOTE', 'ใบเสนอราคาซ่อมตู้คอนโทรล 4,500 บาท กรุณายืนยัน', 'SENT'),
       (?, 'STATUS', 'แจ้งผลการเจาะ: เจาะสำเร็จแล้ว ข้อมูลอยู่ในระบบแล้วครับ', 'SENT'),
       (?, 'REMINDER', 'แจ้งเตือนประกัน: บ่อหน้าไร่กำลังจะหมดอายุ', 'FAILED')`,
      [สมชาย, สมชาย, น้ำทิพย์, สมชาย]
    );

    await conn.commit();
    console.log(`เพิ่มข้อมูลตัวอย่างเรียบร้อย
  ลูกค้า 4 ราย, บ่อ ${wellIds.length} บ่อ
  คำร้องเจาะ 5 รายการ, คิวเจาะ 5 รายการ
  แจ้งซ่อม 6 รายการ (มีบันทึกซ่อม 1 รายการ)`);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
