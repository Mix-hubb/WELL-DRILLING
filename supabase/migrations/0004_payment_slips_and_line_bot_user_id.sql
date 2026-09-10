-- ============================================================
-- 0004: payment_slips table + organizations.line_bot_user_id
-- ปลอดภัยต่อการรันซ้ำ (idempotent) — paste ใน SQL Editor ได้เลย
-- ============================================================

-- ---------- 1) organizations: เพิ่มคอลัมน์ line_bot_user_id ----------
alter table public.organizations
  add column if not exists line_bot_user_id text;

create index if not exists idx_organizations_line_bot_user_id
  on public.organizations (line_bot_user_id);

-- ---------- 2) ตาราง payment_slips ----------
create table if not exists public.payment_slips (
  slip_id        uuid primary key default gen_random_uuid(),
  repair_id      uuid not null references public.repair_requests (repair_id) on delete cascade,
  customer_id    uuid references public.customers (customer_id) on delete set null,
  image_url      text,
  line_message_id text,
  status         text not null default 'PENDING'
                   check (status in ('PENDING','VERIFIED','REJECTED')),
  notes          text,
  submitted_at   timestamptz not null default now(),
  verified_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists idx_payment_slips_repair_id
  on public.payment_slips (repair_id);

create index if not exists idx_payment_slips_customer_id
  on public.payment_slips (customer_id);

-- ---------- 3) repair_requests: เพิ่มคอลัมน์ scheduled_date (ถ้ายังไม่มี) ----------
alter table public.repair_requests
  add column if not exists scheduled_date date;
