-- ============================================================
-- ORGANIZATIONS TABLE (multi-tenant)
-- ย้ายจาก backend/src/db/migration_multi_tenant.sql
-- ใช้ IF NOT EXISTS ทุก statement ปลอดภัยทั้ง fresh DB และ DB ที่มีอยู่แล้ว
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  org_id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text NOT NULL,
  slug                      text UNIQUE NOT NULL,
  invite_code               text UNIQUE NOT NULL DEFAULT substr(gen_random_uuid()::text, 1, 8),
  line_channel_id           text,
  line_channel_secret       text,
  line_channel_access_token text,
  line_liff_id_drilling     text,
  line_liff_id_repair       text,
  line_bot_user_id          text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_organizations_updated'
      AND tgrelid = 'public.organizations'::regclass
  ) THEN
    CREATE TRIGGER trg_organizations_updated
      BEFORE UPDATE ON public.organizations
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_org_channel_id ON public.organizations(line_channel_id);
CREATE INDEX IF NOT EXISTS idx_org_invite ON public.organizations(invite_code);
CREATE INDEX IF NOT EXISTS idx_org_slug ON public.organizations(slug);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(org_id);
CREATE INDEX IF NOT EXISTS idx_users_org ON public.users(org_id);

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(org_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON public.customers(org_id);
