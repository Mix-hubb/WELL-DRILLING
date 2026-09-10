-- ============================================================
-- MULTI-TENANT MIGRATION
-- สร้างตาราง organizations + เพิ่ม org_id ใน users/customers
-- ============================================================

-- 1. สร้างตาราง organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  org_id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                   text NOT NULL,
  slug                   text UNIQUE NOT NULL,
  invite_code            text UNIQUE NOT NULL DEFAULT substr(gen_random_uuid()::text, 1, 8),
  line_channel_id        text,
  line_channel_secret    text,
  line_channel_access_token text,
  line_liff_id_drilling  text,
  line_liff_id_repair    text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_organizations_updated
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Index สำหรับ webhook routing
CREATE INDEX IF NOT EXISTS idx_org_channel_id ON public.organizations(line_channel_id);
CREATE INDEX IF NOT EXISTS idx_org_invite ON public.organizations(invite_code);
CREATE INDEX IF NOT EXISTS idx_org_slug ON public.organizations(slug);

-- 3. เพิ่ม org_id ใน users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(org_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON public.users(org_id);

-- 4. เพิ่ม org_id ใน customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers(org_id);
