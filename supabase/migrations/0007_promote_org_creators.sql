-- ============================================================
-- BACKFILL: โปรโมตผู้สร้างองค์กร (creator) เป็น ADMIN
-- สาเหตุ: register เดิมกำหนดผู้ใช้ทุกคนเป็น DRILLER (รวมถึงผู้ที่
-- สร้างองค์กรใหม่เอง) ทำให้เจ้าขององค์กรที่สมัครก่อนแก้ไข ถูก lock
-- ที่บทบาท DRILLER และแก้ไข/บันทึกข้อมูลในหน้าตั้งค่าไม่ได้
-- (หน้าตั้งค่า ใช้ adminMiddleware ที่ต้อง role = ADMIN)
-- หลักการ: ในแต่ละ org ที่ยังไม่มี ADMIN เลย ให้โปรโมตผู้ใช้ที่
-- สร้างขึ้นเป็นคนแรกสุด (created_at น้อยที่สุด) ให้เป็น ADMIN
-- เพราะผู้ที่สร้าง org ย่อมถูก INSERT ขึ้นเป็นผู้ใช้คนแรกเสมอ
-- รันใน Supabase SQL Editor หรือ psql หนึ่งครั้ง
-- ============================================================

DO $$
DECLARE
  org_rec RECORD;
BEGIN
  FOR org_rec IN
    SELECT org_id FROM public.organizations
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE org_id = org_rec.org_id AND role = 'ADMIN'
    ) THEN
      UPDATE public.users
      SET role = 'ADMIN'
      WHERE user_id = (
        SELECT user_id
        FROM public.users
        WHERE org_id = org_rec.org_id
        ORDER BY created_at ASC, user_id ASC
        LIMIT 1
      );
    END IF;
  END LOOP;
END $$;
