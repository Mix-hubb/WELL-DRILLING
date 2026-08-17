-- ============================================================
-- ระบบจัดการบ่อบาดาลดิจิทัล (Supabase / PostgreSQL) — Schema v2
-- อัปเดตล่าสุดให้ตรงกับ docs/database-schema.md (ล่าสุด)
-- หมายเหตุ:
--   - ไม่มี GPS ในระบบ (ไม่มี latitude/longitude/gps_accuracy_m)
--   - ช่างไม่มีตารางแยก — เข้าผ่าน magic link (drilling_jobs/repair_requests)
--   - ผู้ประกอบการ (login) = ตาราง users (role ADMIN/DRILLER)
--   - ลูกค้า = มาจาก LINE ผ่าน line_user_id (user_id เป็น NULL ได้)
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- (function current_user_role อยู่ท้ายไฟล์ก่อนส่วน RLS
--  เพราะอ้างอิงตาราง users ที่ต้องสร้างเสร็จก่อน)

-- ============================================================
-- USERS: users — ผู้ประกอบการ (login)
-- user_id = auth.users.id (login ผ่าน Supabase Auth / magic link ช่างไม่ใช่ user)
-- role: ADMIN (เจ้าของระบบ) / DRILLER (ช่างที่ login ได้)
-- ============================================================

create table public.users (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  email          text not null unique,
  password_hash  text not null,
  full_name      text not null,
  phone          text,
  role           text not null default 'DRILLER' check (role in ('ADMIN','DRILLER')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger trg_users_updated
  before update on public.users
  for each row execute function public.set_updated_at();

-- ============================================================
-- CORE: customers — ลูกค้า
-- login ผ่าน LINE: เก็บ line_user_id + ชื่อ + รูปโปรไฟล์ (user_id NULL)
-- กรณีผู้ประกอบการกรอกเอง user_id ชี้ไปที่ users.user_id
-- ============================================================

create table public.customers (
  customer_id        uuid primary key default gen_random_uuid(),
  user_id            uuid references public.users(user_id) on delete set null,
  line_user_id       text unique,
  customer_name      text not null,
  phone              text not null,
  phone_alt          text,
  address            text,
  line_display_name  text,
  line_picture_url   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_customer_line on public.customers(line_user_id);
create index idx_customer_user on public.customers(user_id);

create trigger trg_customers_updated
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ============================================================
-- CORE: wells — บ่อบาดาล (สร้างเมื่อเจาะสำเร็จ / หรือกรอกเอง)
-- warranty_expire_date = completion_date + 2 ปี (generated)
-- ============================================================

create table public.wells (
  well_id                uuid primary key default gen_random_uuid(),
  customer_id            uuid not null references public.customers(customer_id) on delete restrict,
  well_name              text not null default 'บ่อหลัก',
  address                text,
  requested_depth_m      numeric(7,2),
  total_depth_m          numeric(7,2),
  drilling_method        text check (drilling_method in ('ROTARY','DTH','CABLE_TOOL','AUGER','JETTING','OTHER')),
  formation_water_type   text not null default 'UNKNOWN' check (formation_water_type in ('FRESH','BRACKISH','SALINE','UNKNOWN')),
  water_quantity_m3hr    numeric(8,2),
  yield_lpm              numeric(8,2),
  static_water_level_m   numeric(7,2),
  pumping_water_level_m  numeric(7,2),
  driller_name           text,
  completion_date        date,
  warranty_expire_date   date generated always as ((completion_date + interval '2 years')::date) stored,
  result                 text not null default 'SUCCESS' check (result in ('SUCCESS','FAIL')),
  failure_reason         text,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_well_customer on public.wells(customer_id);
create index idx_well_completion on public.wells(completion_date);

create trigger trg_wells_updated
  before update on public.wells
  for each row execute function public.set_updated_at();

-- ============================================================
-- WELL DETAIL: well_strata_logs — Geological Log (ชั้นดิน/หิน)
-- ============================================================

create table public.well_strata_logs (
  strata_id         uuid primary key default gen_random_uuid(),
  well_id           uuid not null references public.wells(well_id) on delete cascade,
  depth_from_m      numeric(7,2) not null,
  depth_to_m        numeric(7,2) not null,
  lithology_name    text,
  color_hex         text,
  hardness          text check (hardness in ('VERY_SOFT','SOFT','MEDIUM','HARD','VERY_HARD')),
  water_bearing     boolean not null default false,
  description       text,
  constraint chk_strata_depth check (depth_to_m > depth_from_m)
);

create index idx_strata_well_depth on public.well_strata_logs(well_id, depth_from_m);

-- ============================================================
-- WELL DETAIL: well_pipes — Pipe Specs (PVC/เหล็ก, ทึบ/เซาะร่อง)
-- ============================================================

create table public.well_pipes (
  pipe_id         uuid primary key default gen_random_uuid(),
  well_id         uuid not null references public.wells(well_id) on delete cascade,
  material        text check (material in ('PVC','STEEL','STAINLESS_STEEL','HDPE','OTHER')),
  pipe_type       text check (pipe_type in ('CASING','SCREEN')),
  size_mm         numeric(6,1),
  depth_from_m    numeric(7,2) not null,
  depth_to_m      numeric(7,2) not null,
  quantity        integer not null default 1,
  notes           text,
  constraint chk_pipe_depth check (depth_to_m > depth_from_m)
);

create index idx_pipe_well_depth on public.well_pipes(well_id, depth_from_m);

-- ============================================================
-- WELL DETAIL: well_pumps — Pump Specs
-- ============================================================

create table public.well_pumps (
  pump_id              uuid primary key default gen_random_uuid(),
  well_id              uuid not null references public.wells(well_id) on delete cascade,
  pump_type            text check (pump_type in ('AC_SUBMERSIBLE','DC_SOLAR_SUBMERSIBLE','OTHER')),
  brand                text,
  horsepower           numeric(5,2),
  power_kw             numeric(5,2),
  impeller_stages      integer,
  installation_depth_m numeric(7,2),
  installed_date       date,
  notes                text
);

create index idx_pump_well on public.well_pumps(well_id);

-- ============================================================
-- WELL DETAIL: well_control_boxes — Control Box Specs
-- ============================================================

create table public.well_control_boxes (
  control_box_id  uuid primary key default gen_random_uuid(),
  well_id         uuid not null references public.wells(well_id) on delete cascade,
  brand           text,
  model           text,
  capacity        text,
  voltage         text,
  installed_date  date,
  notes           text
);

create index idx_control_box_well on public.well_control_boxes(well_id);

-- ============================================================
-- REQUEST: drilling_requests — คำร้องแจ้งเจาะ
-- source = GOOGLE_FORM (ลูกค้า) / MANUAL (ผู้ประกอบการกรอกเอง) / LINE
-- status: NEW → QUOTED → ACCEPTED | REJECTED | CANCELLED
-- ============================================================

create table public.drilling_requests (
  request_id         uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.customers(customer_id) on delete cascade,
  source             text not null default 'GOOGLE_FORM' check (source in ('GOOGLE_FORM','MANUAL','LINE')),
  name               text not null,
  phone              text not null,
  address            text not null,
  requested_depth_m  numeric(7,2),
  status             text not null default 'NEW' check (status in ('NEW','QUOTED','ACCEPTED','REJECTED','CANCELLED')),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index idx_drill_req_customer on public.drilling_requests(customer_id);
create index idx_drill_req_status on public.drilling_requests(status);

create trigger trg_drilling_requests_updated
  before update on public.drilling_requests
  for each row execute function public.set_updated_at();

-- ============================================================
-- QUEUE: drilling_jobs — คิวงานเจาะ (Queue Pool, ไม่มีวันที่ตายตัว)
-- ลูกค้ายอมรับราคา → สร้าง job → QUEUED → DRILLING → SUCCESS | FAILED → CLOSED
-- ช่างเข้าผ่าน magic_link_token (ไม่มีตาราง technicians)
-- ============================================================

create table public.drilling_jobs (
  job_id                 uuid primary key default gen_random_uuid(),
  request_id             uuid references public.drilling_requests(request_id) on delete set null,
  customer_id            uuid not null references public.customers(customer_id) on delete restrict,
  well_id                uuid references public.wells(well_id) on delete set null,
  status                 text not null default 'QUEUED' check (status in ('QUEUED','DRILLING','SUCCESS','FAILED','CLOSED')),
  result                 text check (result in ('SUCCESS','FAILED')),
  failure_reason         text,
  job_title              text,
  site_address           text,
  province               text,
  district               text,
  scheduled_date         date,
  magic_link_token       text unique,
  magic_link_expires_at  timestamptz,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_job_customer on public.drilling_jobs(customer_id);
create index idx_job_status on public.drilling_jobs(status);
create index idx_job_magic_link on public.drilling_jobs(magic_link_token);

create trigger trg_drilling_jobs_updated
  before update on public.drilling_jobs
  for each row execute function public.set_updated_at();

-- ============================================================
-- REQUEST: repair_requests — รายการแจ้งซ่อม
-- problems = ปัญหาที่ติ๊ก (jsonb array), photos = URL รูปที่แนบ (jsonb array)
-- status: NEW → QUOTED → ACCEPTED → SCHEDULED → IN_PROGRESS → COMPLETED
--         | REJECTED | CANCELLED
-- ============================================================

create table public.repair_requests (
  repair_id             uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.customers(customer_id) on delete cascade,
  well_id               uuid references public.wells(well_id) on delete set null,
  problems              jsonb not null default '[]'::jsonb,
  detail                text,
  photos                jsonb,
  scheduled_date        date,
  status                text not null default 'NEW' check (status in ('NEW','QUOTED','ACCEPTED','REJECTED','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')),
  magic_link_token      text unique,
  magic_link_expires_at timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_repair_customer on public.repair_requests(customer_id);
create index idx_repair_status on public.repair_requests(status);
create index idx_repair_magic_link on public.repair_requests(magic_link_token);

create trigger trg_repair_requests_updated
  before update on public.repair_requests
  for each row execute function public.set_updated_at();

-- ============================================================
-- QUOTE: quotations — ราคาประเมิน (เจาะ/ซ่อม) + ยอมรับ/ปฏิเสธของลูกค้า
-- ============================================================

create table public.quotations (
  quotation_id        uuid primary key default gen_random_uuid(),
  kind                text not null check (kind in ('DRILLING','REPAIR')),
  drilling_request_id uuid references public.drilling_requests(request_id) on delete restrict,
  repair_request_id   uuid references public.repair_requests(repair_id) on delete restrict,
  price               numeric(12,2) not null,
  status              text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED')),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint chk_quotation_kind check (
    (kind = 'DRILLING' and drilling_request_id is not null and repair_request_id is null)
    or
    (kind = 'REPAIR' and repair_request_id is not null and drilling_request_id is null)
  )
);

create index idx_quotes_drilling on public.quotations(drilling_request_id);
create index idx_quotes_repair on public.quotations(repair_request_id);
create index idx_quotes_status on public.quotations(status);

create trigger trg_quotations_updated
  before update on public.quotations
  for each row execute function public.set_updated_at();

-- ============================================================
-- RECORD: repair_records — ช่างบันทึกหลังซ่อมเสร็จ
-- ============================================================

create table public.repair_records (
  record_id         uuid primary key default gen_random_uuid(),
  repair_id         uuid not null references public.repair_requests(repair_id) on delete cascade,
  final_price       numeric(12,2),
  work_details      text,
  parts             jsonb,
  payment_slip_url  text,
  is_warranty_claim boolean not null default false,
  completed_at      timestamptz,
  created_at        timestamptz not null default now()
);

create index idx_record_repair on public.repair_records(repair_id);

-- ============================================================
-- LINE: line_notifications — log การส่งข้อความกลับ LINE ถึงลูกค้า
-- ============================================================

create table public.line_notifications (
  notification_id  uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers(customer_id) on delete cascade,
  kind             text check (kind in ('QUOTE','STATUS','REMINDER','OTHER')),
  content          text,
  line_message_id  text,
  status           text not null default 'SENT' check (status in ('SENT','FAILED')),
  sent_at          timestamptz not null default now()
);

create index idx_notif_customer on public.line_notifications(customer_id);

-- ============================================================
-- VIEW: well_warranty_view — สถานะประกัน (สำหรับ LINE bot / Dashboard)
-- ============================================================

create or replace view public.well_warranty_view as
select
  w.well_id,
  w.well_name,
  w.customer_id,
  c.customer_name,
  c.line_user_id,
  w.completion_date,
  w.warranty_expire_date,
  (w.warranty_expire_date - current_date) as days_left,
  case
    when w.warranty_expire_date is null then 'UNKNOWN'
    when w.warranty_expire_date >= current_date then 'ACTIVE'
    else 'EXPIRED'
  end as warranty_status
from public.wells w
join public.customers c on c.customer_id = w.customer_id;

-- ============================================================
-- HELPER FUNCTIONS (สร้างตอนนี้ เพราะตารางทั้งหมดมีแล้ว)
-- ============================================================

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.users where user_id = auth.uid()
$$;

grant execute on function public.current_user_role() to authenticated, anon;

-- ============================================================
-- ROW LEVEL SECURITY
-- ผู้ประกอบการ (users role ADMIN/DRILLER): เข้าถึงทุกอย่าง
-- ลูกค้า / LINE / Webhook / Magic link: ทำงานผ่าน backend (service role)
-- ============================================================

alter table public.users enable row level security;
alter table public.customers enable row level security;
alter table public.wells enable row level security;
alter table public.well_strata_logs enable row level security;
alter table public.well_pipes enable row level security;
alter table public.well_pumps enable row level security;
alter table public.well_control_boxes enable row level security;
alter table public.drilling_requests enable row level security;
alter table public.drilling_jobs enable row level security;
alter table public.repair_requests enable row level security;
alter table public.quotations enable row level security;
alter table public.repair_records enable row level security;
alter table public.line_notifications enable row level security;

-- ---------- users ----------
create policy "users_select_own" on public.users
  for select to authenticated using (user_id = auth.uid());

create policy "users_update_own" on public.users
  for update to authenticated using (user_id = auth.uid());

-- ---------- contractor (ADMIN/DRILLER): full access ----------
create policy "customer_all" on public.customers
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

create policy "well_all" on public.wells
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

create policy "strata_all" on public.well_strata_logs
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

create policy "pipes_all" on public.well_pipes
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

create policy "pumps_all" on public.well_pumps
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

create policy "control_boxes_all" on public.well_control_boxes
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

create policy "drilling_req_all" on public.drilling_requests
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

create policy "drilling_jobs_all" on public.drilling_jobs
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

create policy "repair_all" on public.repair_requests
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

create policy "quotes_all" on public.quotations
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

create policy "repair_records_all" on public.repair_records
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

create policy "notifications_all" on public.line_notifications
  for all to authenticated
  using (public.current_user_role() in ('ADMIN','DRILLER'))
  with check (public.current_user_role() in ('ADMIN','DRILLER'));

-- ============================================================
-- END OF SCHEMA
-- ============================================================
