-- ============================================================
-- BACKFILL: invite code สำหรับองค์กรที่ยังไม่มีรหัสเชิญ
-- สาเหตุ: คอลัมน์ invite_code ถูกเพิ่มภายหลัง องค์กรเดิมจึงมีค่า NULL
-- ส่งผลให้รหัสเชิญแสดงเป็น "—" / สร้างรหัสใหม่ไม่ได้
-- รันใน PostgreSQL (psql) หนึ่งครั้ง
-- ============================================================

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS invite_code text;

DO $$
DECLARE
  org_rec   RECORD;
  new_code  text;
  saved     boolean;
BEGIN
  FOR org_rec IN
    SELECT org_id FROM public.organizations
    WHERE invite_code IS NULL OR invite_code = ''
  LOOP
    new_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    saved := FALSE;
    WHILE NOT saved LOOP
      BEGIN
        UPDATE public.organizations
        SET invite_code = new_code
        WHERE org_id = org_rec.org_id;
        saved := TRUE;
      EXCEPTION WHEN unique_violation THEN
        new_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      END;
    END LOOP;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organizations_invite_code_key'
      AND conrelid = 'public.organizations'::regclass
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_invite_code_key UNIQUE (invite_code);
  END IF;
END $$;

ALTER TABLE public.organizations ALTER COLUMN invite_code SET NOT NULL;
ALTER TABLE public.organizations ALTER COLUMN invite_code SET DEFAULT substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);