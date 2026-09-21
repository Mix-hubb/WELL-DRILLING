-- ============================================================
-- 0009: ลบคอลัมน์ wells.yield_lpm / static_water_level_m / pumping_water_level_m
-- คอลัมน์เหล่านี้ถูกลบออกจากฐานข้อมูล production แล้วโดยไม่ผ่าน migration
-- (0001_init.sql ยังสร้างคอลัมน์เหล่านี้อยู่ ทำให้ schema ไม่ตรงกับ production จริง)
-- migration นี้ทำให้ fresh DB ที่รัน 0001 ตามด้วย 0009 ตรงกับ production ปัจจุบัน
-- ใช้ IF EXISTS ปลอดภัยทั้งกับ DB ที่มีคอลัมน์อยู่แล้วและ DB ที่ถูกลบไปแล้ว
-- ============================================================

ALTER TABLE public.wells DROP COLUMN IF EXISTS yield_lpm;
ALTER TABLE public.wells DROP COLUMN IF EXISTS static_water_level_m;
ALTER TABLE public.wells DROP COLUMN IF EXISTS pumping_water_level_m;
