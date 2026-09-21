-- ============================================================
-- 0004: organizations.line_bot_user_id + repair_requests.scheduled_date
-- ปลอดภัยต่อการรันซ้ำ (idempotent) — paste ใน SQL Editor ได้เลย
-- ============================================================

-- ---------- 1) organizations: เพิ่มคอลัมน์ line_bot_user_id ----------
alter table public.organizations
  add column if not exists line_bot_user_id text;

create index if not exists idx_organizations_line_bot_user_id
  on public.organizations (line_bot_user_id);

-- ---------- 2) repair_requests: เพิ่มคอลัมน์ scheduled_date (ถ้ายังไม่มี) ----------
alter table public.repair_requests
  add column if not exists scheduled_date date;
