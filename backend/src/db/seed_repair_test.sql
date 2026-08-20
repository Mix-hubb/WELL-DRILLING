SET NAMES utf8mb4;
USE well_drilling;

INSERT INTO quotations (kind, repair_request_id, price, status, notes) VALUES
  ('REPAIR', 8, 3500, 'PENDING', 'เปลี่ยนตู้คุมไฟ + เบรกเกอร์'),
  ('REPAIR', 9, 8500, 'ACCEPTED', 'เปลี่ยนปั๊มซับเมอร์ส 1.5 HP'),
  ('REPAIR', 10, 2000, 'ACCEPTED', 'ล้างบ่อ + เปลี่ยนไส้กรอง'),
  ('REPAIR', 11, 5500, 'ACCEPTED', 'ซ่อมระบบไฟ + เปลี่ยนคาปาซิเตอร์'),
  ('REPAIR', 13, 3200, 'ACCEPTED', 'เปลี่ยนปั๊ม + ตรวจระบบไฟ');

INSERT INTO repair_records (repair_id, final_price, work_details, parts, completed_at) VALUES
  (13, 3200, 'เปลี่ยนปั๊มซับเมอร์ส + ตรวจระบบไฟฟ้า',
   JSON_ARRAY(
     JSON_OBJECT('name', 'คาปาซิเตอร์ 30uF', 'qty', 1, 'unit_price', 1200),
     JSON_OBJECT('name', 'ค่าแรงช่าง', 'qty', 1, 'unit_price', 2000)
   ), NOW());
