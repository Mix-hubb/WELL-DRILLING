SET NAMES utf8mb4;
-- ============================================================
-- ระบบจัดการบ่อบาดาลดิจิทัล — ข้อมูลตัวอย่าง (Seed) สำหรับ schema v4
-- ============================================================
USE well_drilling;

-- ============================================================
-- AUTH: ผู้ประกอบการ (รายย่อย)
-- ============================================================
INSERT INTO users (email, password_hash, full_name, phone, role) VALUES
  ('owner@welldrill.com', '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'สมชาย เจ้าของกิจการ', '0811111111', 'USER'),
  ('manager@welldrill.com', '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'ประหยัด ผู้จัดการงาน', '0822222222', 'USER');

-- ============================================================
-- CUSTOMERS: ลูกค้าผ่าน LINE + ลูกค้าที่กรอกเอง
-- ============================================================
INSERT INTO customers (user_id, line_user_id, customer_name, phone, phone_alt, address, line_display_name, line_picture_url) VALUES
  (NULL, 'U-line-abc123', 'สมหญิง', '0812345678', NULL, '123 หมู่ 5 ต.นครปฐม อ.เมือง จ.นครปฐม 73000', 'หญิง', 'https://profile.line-scdn.net/abc123.png'),
  (NULL, NULL, 'สมปอง', '0899999999', '0866666666', '45 ถ.เพชรเกษม ต.สามพราน อ.สามพราน จ.นครปฐม 73110', NULL, NULL);

-- ============================================================
-- FLOW A: แจ้งเจาะ → ตีราคา → ลูกค้ายอมรับ → คิว → เจาะสำเร็จ → บ่อ
-- ============================================================
INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, status, notes) VALUES
  (1, 'GOOGLE_FORM', 'สมหญิง', '0812345678', '123 หมู่ 5 ต.นครปฐม อ.เมือง จ.นครปฐม 73000', 60, 'ACCEPTED', 'มาจาก Google Form ผ่าน LINE'),
  (2, 'MANUAL', 'สมปอง', '0899999999', '45 ถ.เพชรเกษม อ.สามพราน จ.นครปฐม', 30, 'NEW', 'ผู้ประกอบการกรอกเอง');

INSERT INTO quotations (kind, drilling_request_id, price, status, notes) VALUES
  ('DRILLING', 1, 45000, 'ACCEPTED', 'รวมท่อ PVC 6 นิ้ว 60 เมตร + ปั๊ม 1.5 HP');

INSERT INTO drilling_jobs (request_id, customer_id, status, job_title, site_address, province, district, magic_link_token, magic_link_expires_at) VALUES
  (1, 1, 'SUCCESS', 'เจาะบ่อหลังบ้านคุณสมหญิง', '123 หมู่ 5 ต.นครปฐม อ.เมือง จ.นครปฐม', 'นครปฐม', 'เมืองนครปฐม', 'magic-drill-001', DATE_ADD(NOW(), INTERVAL 48 HOUR));

INSERT INTO wells (customer_id, well_name, address, total_depth_m, drilling_method, formation_water_type, water_quantity_m3hr, static_water_level_m, pumping_water_level_m, driller_name, completion_date, result, notes) VALUES
  (1, 'บ่อหลังบ้าน', '123 หมู่ 5 ต.นครปฐม อ.เมือง จ.นครปฐม', 60, 'ROTARY', 'FRESH', 5.00, 12.5, 25.0, 'ช่างเอก', '2026-08-01', 'SUCCESS', 'น้ำดี คุณภาพใช้ได้');

UPDATE drilling_jobs SET well_id = 1, result = 'SUCCESS' WHERE job_id = 1;

INSERT INTO well_strata_logs (well_id, depth_from_m, depth_to_m, lithology_type, lithology_name, color_hex, hardness, water_bearing, description) VALUES
  (1, 0, 4,  'TOP_SOIL', 'ดินบน', '#8B5E3C', 'SOFT', 0, 'ชั้นดินบน'),
  (1, 4, 15, 'SAND', 'ทรายละเอียด', '#D9C89A', 'MEDIUM', 0, ''),
  (1, 15, 60, 'GRAVEL', 'ทรายหยาบ + กรวด', '#A9A9A9', 'HARD', 1, 'ชั้นน้ำบาดาลหลัก');

INSERT INTO well_pipes (well_id, material, pipe_type, size_mm, depth_from_m, depth_to_m, quantity, notes) VALUES
  (1, 'PVC', 'CASING', 152.4, 0, 40, 14, 'ท่อทึบ 6 นิ้ว'),
  (1, 'PVC', 'SCREEN', 152.4, 40, 60, 7, 'ท่อเซาะร่องช่วงชั้นน้ำ');

INSERT INTO well_pumps (well_id, pump_type, brand, pump_model, horsepower, power_kw, impeller_stages, installation_depth_m, voltage, phase, discharge_size_mm, rated_flow_m3hr, rated_head_m, installed_date) VALUES
  (1, 'AC_SUBMERSIBLE', 'HITACHI', 'HP150-5', 1.5, 1.1, 5, 55, '220', 1, 50, 6.0, 45, '2026-08-01');

INSERT INTO well_control_boxes (well_id, brand, model, capacity, voltage, protection_type, features, installed_date) VALUES
  (1, 'Mitsubishi', 'NC-1.5', '1.5 HP', '220V', 'OVERLOAD_RELAY', 'คอนแทคเตอร์ + รีเลย์กันโหลดเกิน + เบรกเกอร์', '2026-08-01');

-- ============================================================
-- FLOW B: แจ้งซ่อม → ตีราคา → ยอมรับ → รอวันนัด → ซ่อมเสร็จ → บันทึก
-- ============================================================
INSERT INTO repair_requests (customer_id, well_id, problems, detail, photos, scheduled_date, status, magic_link_token, magic_link_expires_at) VALUES
  (1, 1,
   JSON_ARRAY('ปั๊มไม่ทำงาน', 'น้ำออกน้อย'),
   'ปั๊มไม่ตัดเมื่อเปิดก๊อกน้ำ เปลี่ยนสายไม่เป็นน้ำ',
   JSON_ARRAY('https://storage.example.com/photo1.jpg', 'https://storage.example.com/photo2.jpg'),
   '2026-08-20', 'COMPLETED', 'magic-repair-001', DATE_ADD(NOW(), INTERVAL 48 HOUR));

INSERT INTO quotations (kind, repair_request_id, price, status, notes) VALUES
  ('REPAIR', 1, 3500, 'ACCEPTED', 'ค่าอะไหล่ + ค่าแรง');

INSERT INTO repair_records (repair_id, final_price, work_details, parts, pump, payment_slip_url, is_warranty_claim, completed_at) VALUES
  (1, 3500, 'เปลี่ยนคาปาซิเตอร์ + ตรวจสวิทช์ลูกลอย + ล้างถังเก็บน้ำ',
   JSON_ARRAY(
     JSON_OBJECT('name', 'คาปาซิเตอร์ 30uF', 'qty', 1, 'unit_price', 1200),
     JSON_OBJECT('name', 'ค่าแรงช่าง', 'qty', 1, 'unit_price', 1500)
   ),
   JSON_OBJECT(
     'model_id', 13, 'brand', 'TORQUE', 'series', '4BM Series',
     'model', 'TQ-SP 4BM14-4/S', 'motor_power', '1.5 HP (1.1 kW)',
     'phase', '1 เฟส 220V', 'discharge_size', '1.5"',
     'impeller_stages', '14 ใบ', 'max_head_m', '84 ม.',
     'reference_price', 13623.00
   ),
   'https://storage.example.com/slip1.png', 0, NOW());

UPDATE repair_requests SET status = 'COMPLETED' WHERE repair_id = 1;

-- ============================================================
-- LINE LOG: บันทึกการส่งข้อความกลับหาลูกค้า
-- ============================================================
INSERT INTO line_notifications (customer_id, kind, content, status) VALUES
  (1, 'QUOTE', 'แจ้งราคาเจาะบ่อ 45,000 บาท กดยอมรับเพื่อเข้าคิวเจาะ', 'SENT'),
  (1, 'QUOTE', 'แจ้งราคาซ่อมปั๊ม 3,500 บาท กดยอมรับเพื่อนัดช่าง', 'SENT'),
  (1, 'STATUS', 'บ่อหลังบ้านเจาะสำเร็จเรียบร้อย รายละเอียดบ่อดูได้จากเมนู', 'SENT');

-- ============================================================
-- MASTER: แคตตาล็อกปั๊มซับเมอร์ส (ปั๊มบ่อบาดาล)
-- Franklin Electric (สหรัฐอเมริกา) + TORQUE (นำเข้าอิตาลี โดย SOIHA INTERGROUP)
-- สำหรับ dropdown: เลือกยี่ห้อ → เลือกรุ่น → ข้อมูลปั๊มขึ้นอัตโนมัติ
-- ============================================================
INSERT INTO pump_catalog_models
  (brand, series, model, bore_size, flow_rate, motor_power, phase, discharge_size, impeller_stages, max_head_m, material, features, reference_price, notes, sort_order) VALUES
-- ===== Franklin Electric =====
('FRANKLIN', '3200 Series', '3200 Series (4")', '4', '5/7/10/15/25 gpm', '0.5-10 HP', '1/3 เฟส', '1.25" NPT', '6-44 สเตจ', 'สูงสุด ~500 ม.', 'สแตนเลส + เทอร์โมพลาสติก', 'ขนาดกะทัดรัด เส้นผ่านศูนย์กลาง 3.75" รวมสายไฟ', NULL, NULL, 1),
('FRANKLIN', '4400 Tri Seal Series', '4400 Tri Seal Series (4")', '4', '18/25/30/45/60/70 LPM', '0.5-7.5 HP', '1/3 เฟส', '2" BSP', 'หลายสเตจ', 'สูงสุด ~430 ม.', 'AISI 304', 'ระบบ Tri-Seal ป้องกันทราย ใบพัดแบบ floating', NULL, NULL, 2),
('FRANKLIN', '4400 High Capacity', '4400 High Capacity (4")', '4', '100/150/200/270 LPM', '0.75-7.5 HP', '1/3 เฟส', '2" BSP', 'หลายสเตจ', 'สูงสุด ~300 ม.', 'สแตนเลส', 'อัตราการไหลสูง เหมาะสำหรับบ่อ 4 นิ้ว', NULL, NULL, 3),
('FRANKLIN', '6" Tri Seal High Capacity', '6" Tri Seal High Capacity', '6', '50/75/100/125 gpm', '1.5-40 HP', '1/3 เฟส', '2" NPT', '3-44 สเตจ', 'สูงสุด ~366 ม. (1,200 ft)', 'สแตนเลส', 'สำหรับงานอัตราการไหลสูง', NULL, NULL, 4),
('FRANKLIN', 'SSI Series', 'SSI Series (6"/8"/10")', '6/8/10', '6-270 m³/h', '0.55-55 kW', '1/3 เฟส', 'Rp 2.5"/3"/4"/5"', '1-42 สเตจ', 'สูงสุด 377 ม.', 'AISI 304', 'ปั๊ม turbine แบบ stamped stainless steel ซ่อมบำรุงได้', NULL, NULL, 5),
('FRANKLIN', 'SR Series', 'SR Series (6"/8")', '6/8', 'สูงสุด 80 m³/h (50Hz)', 'สูงสุด 400 kW', '3 เฟส', 'Rp 2"-4"', 'หลายสเตจ', 'สูงสุด 700 ม. (70 Bar)', 'AISI 304/316/904L', 'รองรับอุณหภูมิสูงสุด 90°C มีเวอร์ชัน high pressure', NULL, NULL, 6),
('FRANKLIN', 'FS Series', 'FS Series (8"-16")', '8/10/12/14/16', '100-1,000 m³/h', 'สูงสุด 400 kW', '3 เฟส', 'หน้าแปลน (Flanged)', 'หลายสเตจ', 'สูงสุด 700 ม.', 'AISI 316', 'งานอุตสาหกรรมปริมาณน้ำมาก', NULL, NULL, 7),
('FRANKLIN', 'J-Class', 'J-Class (4")', '4', '5/7/10/15/20/25 gpm', '0.5-5 HP', '1/3 เฟส', '1.25" NPT', 'หลายสเตจ', 'สูงสุด ~1,600 ft', 'สแตนเลส + เทอร์โมพลาสติก', 'ซีรีส์เก่าที่ทนทาน มีแคตตาล็อกครบรุ่น', NULL, NULL, 8),
('FRANKLIN', 'High Capacity 4"', '100FH (High Capacity 4")', '4', '100 LPM', '0.75-7.5 HP', '1/3 เฟส', '2"', 'หลายสเตจ', 'สูงสุด ~250 ม.', 'สแตนเลส', NULL, NULL, NULL, 9),
('FRANKLIN', 'J-Class 4"', '100FA2S4-PEXB (J-Class)', '4', NULL, '2 HP (1,500 W)', '1 เฟส 220V', '2"', '12 ใบ', NULL, 'สแตนเลส', NULL, 26490.00, NULL, 10),
('FRANKLIN', 'High Capacity 4" (หัวปั๊ม)', '12AD26-75 (หัวปั๊ม)', '4', '160-260 LPM', '7.5 HP', NULL, '1.5"', '26 ใบ', '111-47 ม.', 'สแตนเลส', NULL, 10560.00, NULL, 11),
('FRANKLIN', 'High Capacity 4"', 'High Capacity 4" 2HP (1 เฟส)', '4', NULL, '2 HP', '1 เฟส', NULL, NULL, '~200 ม.', NULL, NULL, NULL, NULL, 12),
('FRANKLIN', 'High Capacity 4"', 'High Capacity 4" 2HP (3 เฟส)', '4', NULL, '2 HP', '3 เฟส', NULL, NULL, '~200 ม.', NULL, NULL, 31574.00, NULL, 13),
('FRANKLIN', 'High Capacity 4"', 'High Capacity 4" 3HP (1 เฟส)', '4', NULL, '3 HP', '1 เฟส', NULL, NULL, '~250 ม.', NULL, NULL, 22950.00, NULL, 14),
('FRANKLIN', 'High Capacity 4"', 'High Capacity 4" 3HP (3 เฟส)', '4', NULL, '3 HP', '3 เฟส', NULL, NULL, '~250 ม.', NULL, NULL, 23450.00, NULL, 15),
('FRANKLIN', 'มอเตอร์ 6"', 'Y DELTA มอเตอร์ 6" 20HP', '6', NULL, '20 HP', '3 เฟส 380V', NULL, NULL, NULL, NULL, 'มอเตอร์ปั๊มขนาด 6 นิ้ว แบบ Y-Delta', 105800.00, NULL, 16),

-- ===== TORQUE (นำเข้าอิตาลี โดย SOIHA INTERGROUP) =====
('TORQUE', '2BM Series', '2BM Series (3")', '3', '50 LPM', '0.5-2 HP', '1/3 เฟส', NULL, '11-37 ใบ', 'สูงสุด 140 ม.', 'AISI 304', NULL, NULL, 'ขนาดบ่อ 3"/4"/6" | กำลังรวม 0.33-20 HP | ใบพัด 3-40 | อัตราไหล 50-1,200 LPM | AC 1 เฟส 220V / 3 เฟส 380V | ทนไฟ 1 เฟส 170-240V / 3 เฟส 350-380V | กันน้ำ IP68 Class F (155°C) | แรงกดเพลา 6,500 N สตาร์ท 30 ครั้ง/ชม. | รับประกัน 1 ปี (PRO SERIES 2 ปี) | มาตรฐาน FDA NEMA KTW ACS WRAS', 1),
('TORQUE', '2BH/2BM Series', '2BH/2BM Series (4")', '4', '2 m³/h', '0.33-1.5 HP', '1/3 เฟส', NULL, 'หลายสเตจ', NULL, 'AISI 304', NULL, NULL, NULL, 2),
('TORQUE', '4BH/4BM Series', '4BH/4BM Series (4")', '4', '4 m³/h', '1-3 HP', '1/3 เฟส', NULL, 'หลายสเตจ', NULL, 'AISI 304', NULL, NULL, NULL, 3),
('TORQUE', '6BH/6BM Series', '6BH/6BM Series (4")', '4', '6 m³/h', '1.5-5 HP', '1/3 เฟส', NULL, 'หลายสเตจ', NULL, 'AISI 304', NULL, NULL, NULL, 4),
('TORQUE', '8BH/8BM Series', '8BH/8BM Series (4")', '4', '8 m³/h', '3-7.5 HP', '1/3 เฟส', NULL, 'หลายสเตจ', NULL, 'AISI 304', NULL, NULL, NULL, 5),
('TORQUE', '12/16 BH Series', '12/16 BH Series (4")', '4', '12/16 m³/h', '5-10 HP', '1/3 เฟส', NULL, 'หลายสเตจ', NULL, 'AISI 304', NULL, NULL, NULL, 6),
('TORQUE', '14SP Series', '14SP Series (4")', '4', '14 m³/h', '7.5-10 HP', '1/3 เฟส', NULL, 'หลายสเตจ', NULL, 'AISI 304', NULL, NULL, NULL, 7),
('TORQUE', '4BG Series', '4BG Series (3.5")', '3.5', '4 m³/h', '1-3 HP', '1/3 เฟส', NULL, 'หลายสเตจ', NULL, 'AISI 304', NULL, NULL, NULL, 8),
('TORQUE', '30BP Series', '30BP Series (6")', '6', 'สูงสุด 1,200 LPM', '5.5-20 HP', '1/3 เฟส', '3"', '3-5 ใบ', 'สูงสุด 70 ม.', 'AISI 304', NULL, NULL, NULL, 9),
('TORQUE', '2BM Series', 'TQ-SP 2BM16-3/S', '3', NULL, '0.75 HP (0.55 kW)', '1 เฟส 220V', '1.25"', '16 ใบ', '64 ม.', 'AISI 304', NULL, 10406.00, 'เหมาะสำหรับบ่อลึก 37-60 ม.', 10),
('TORQUE', '2BM Series', 'TQ-SP 2BM20-4/ST', '4', NULL, '1.5 HP (1.1 kW)', '3 เฟส 220V', '1.5"', '20 ใบ', '130 ม.', 'AISI 304', NULL, 13915.00, 'เหมาะสำหรับบ่อลึก 53-119 ม.', 11),
('TORQUE', '4BM Series', 'TQ-SP 4BM09-4', '4', NULL, '1 HP', NULL, NULL, '9 ใบ', NULL, 'AISI 304', NULL, 14190.00, NULL, 12),
('TORQUE', '4BM Series', 'TQ-SP 4BM14-4/S', '4', NULL, '1.5 HP (1.1 kW)', '1 เฟส 220V', '1.5"', '14 ใบ', '84 ม.', 'AISI 304', NULL, 13623.00, 'ราคาโดยประมาณ ~11,800-13,623 บาท', 13),
('TORQUE', '4BM Series', 'TQ-SP 4BM14-4', '4', NULL, '1.5 HP (1.1 kW)', '3 เฟส 220V', '1.5"', '14 ใบ', NULL, 'AISI 304', NULL, NULL, NULL, 14),
('TORQUE', '6BM Series', 'TQ-SP 6BM10-4', '4', NULL, '1.5 HP', NULL, '2"', '10 ใบ', NULL, 'AISI 304', NULL, NULL, NULL, 15),
('TORQUE', '30BP Series', 'TQ-SP 30BP03-6', '6', NULL, '3 HP (2.2 kW)', '3 เฟส 220V', '3"', '3 ใบ', '39 ม.', 'AISI 304', NULL, NULL, NULL, 16),
('TORQUE', 'ปั๊มจุ่ม', 'TQ-SP-M120', NULL, '91 LPM', '100 W', '1 เฟส 220V', '3/4" - 1"', NULL, '6.5 ม.', NULL, 'ปั๊มจุ่มระบายน้ำ', NULL, NULL, 17),
('TORQUE', 'ปั๊มจุ่ม', 'TQ-SP-M450', NULL, '250 LPM', '450 W', '1 เฟส 220V', '2"', NULL, '12 ม.', NULL, 'ปั๊มจุ่มระบายน้ำ', NULL, NULL, 18),
('TORQUE', 'ปั๊มจุ่ม TDS', 'TQ-SP-TDS180', NULL, '120 LPM', '300 W (มอเตอร์ 180 W)', '1 เฟส 220V', '1"', NULL, '6 ม.', NULL, 'ปั๊มจุ่มระบายน้ำ', NULL, '2,860 rpm', 19),
('TORQUE', 'ปั๊มจุ่ม TDS', 'TQ-SP-TDS550F', NULL, '300 LPM', '800 W (มอเตอร์ 550 W)', '1 เฟส 220V', '2"', NULL, '10 ม.', NULL, 'ปั๊มจุ่มระบายน้ำ', NULL, '2,860 rpm', 20),
('TORQUE', 'ปั๊มจุ่ม TDS', 'TQ-SP-TDS750', NULL, '350 LPM', '1,000 W (มอเตอร์ 750 W)', '1 เฟส 220V', '2"', NULL, '12 ม.', NULL, 'ปั๊มจุ่มระบายน้ำ', NULL, '2,860 rpm', 21),
('TORQUE', 'ปั๊มโซลาร์', 'TQ-SP-4DC0806-AD-A11/S', '4', NULL, '1.5 HP (1,100 W)', '1 เฟส 220V / DC', '2"', '6 ใบ', '75 ม.', 'AISI 304', 'ปั๊มโซลาร์ รองรับไฟ AC/DC ใช้ร่วมกับโซลาร์เซลล์', NULL, NULL, 22);
