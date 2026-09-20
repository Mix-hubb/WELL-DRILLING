-- Enforce LINE identity and webhook routing per organization.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS line_bot_user_id text;

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_line_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_org_line_user
  ON public.customers (org_id, line_user_id)
  WHERE line_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_line_channel_id
  ON public.organizations (line_channel_id)
  WHERE line_channel_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_line_bot_user_id
  ON public.organizations (line_bot_user_id)
  WHERE line_bot_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_liff_drilling
  ON public.organizations (line_liff_id_drilling)
  WHERE line_liff_id_drilling IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_liff_repair
  ON public.organizations (line_liff_id_repair)
  WHERE line_liff_id_repair IS NOT NULL;
