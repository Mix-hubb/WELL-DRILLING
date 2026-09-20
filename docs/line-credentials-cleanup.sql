-- Helper: ดู/ปลด LINE credentials ที่ค้างในองค์กรเก่า
-- รันใน Supabase SQL Editor เฉพาะเมื่อกดบันทึกหน้าตั้งค่ายังไม่ย้ายการผูกให้
-- ระบบเวอร์ชันล่าสุดจะปลดให้อัตโนมัติเมื่อกดบันทึกที่หน้าตั้งค่า

-- 1. ดูองค์กรที่ถือครอง LINE credentials
SELECT org_id, name, slug, line_channel_id, line_bot_user_id, line_liff_id_drilling, line_liff_id_repair
FROM organizations;

-- 2. ปลด credentials จากองค์กรเดิม (แทนที่ '<เก่า_org_id>')
-- UPDATE organizations
-- SET line_channel_id = NULL,
--     line_channel_secret = NULL,
--     line_channel_access_token = NULL,
--     line_bot_user_id = NULL,
--     line_liff_id_drilling = NULL,
--     line_liff_id_repair = NULL
-- WHERE org_id = '<เก่า_org_id>';
