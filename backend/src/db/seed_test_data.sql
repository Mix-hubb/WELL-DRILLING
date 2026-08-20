SET NAMES utf8mb4;
USE well_drilling;

INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, status, notes) VALUES
  (9, 'LINE', 'ประเสริฐ ใจดี', '0891112222', '88 หมู่ 3 ต.บ่อิน อ.บ่อิน จ.บุรีรัมย์', 70, 'NEW', 'ลูกค้าแจ้งผ่าน LINE OA'),
  (10, 'LINE', 'สมศักดิ์ มั่งมี', '0833322333', '5/1 หมู่ 6 ต.แม่เหียบ อ.แม่สรวย จ.เชียงราย', 50, 'NEW', 'ต้องการเจาะลึก 50 ม.'),
  (11, 'LINE', 'ดาราวรรณ ศรีสุข', '0844445555', '99 ถ.สุขุมวิท ต.บางแสน อ.แสนสุข จ.ชลบุรี', 30, 'NEW', 'เจาะบ่อหลังบ้าน');
