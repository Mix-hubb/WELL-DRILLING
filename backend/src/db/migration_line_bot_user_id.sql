-- ============================================================
-- MIGRATION: Add line_bot_user_id and payment_slips table
-- วัตถุประสงค์:
--   1. เพิ่มคอลัมน์ line_bot_user_id ใน organizations
--      เพื่อใช้ match กับ body.destination ใน LINE Webhook
--      (destination = Bot User ID ขึ้นต้นด้วย U...)
--   2. สร้างตาราง payment_slips เพื่อรองรับการรับสลิปโอนเงิน
-- ============================================================

-- 1. เพิ่ม line_bot_user_id ใน organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS line_bot_user_id text;

CREATE INDEX IF NOT EXISTS idx_org_bot_user_id
  ON public.organizations(line_bot_user_id);

-- 2. สร้างตาราง payment_slips
CREATE TABLE IF NOT EXISTS public.payment_slips (
  slip_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id        uuid NOT NULL REFERENCES public.repair_requests(repair_id) ON DELETE CASCADE,
  customer_id      uuid REFERENCES public.customers(customer_id),
  image_url        text,
  line_message_id  text,
  status           text NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  notes            text,
  submitted_at     timestamptz NOT NULL DEFAULT now(),
  verified_at      timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_slips_repair
  ON public.payment_slips(repair_id);

CREATE INDEX IF NOT EXISTS idx_payment_slips_customer
  ON public.payment_slips(customer_id);
