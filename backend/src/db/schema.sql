SET NAMES utf8mb4;
-- ============================================================
-- ระบบจัดการบ่อบาดาลดิจิทัล (MySQL 8.0+) — Schema v4
-- อัปเดตตามข้อมูลล่าสุด: LINE OA + Web (ผู้ประกอบการ) + Magic Link (ช่าง)
-- ลูกค้าเป็นผู้เริ่มคำร้อง (แจ้งเจาะ / แจ้งซ่อม) ผ่าน LINE
-- utf8mb4 | InnoDB
-- ============================================================

CREATE DATABASE IF NOT EXISTS well_drilling
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE well_drilling;

-- ============================================================
-- DROP ตารางเดิม (schema เก่า) — ไล่จากลูกก่อนเสมอ
-- ============================================================
DROP TABLE IF EXISTS pump_catalog_models;
DROP TABLE IF EXISTS well_strata_logs;
DROP TABLE IF EXISTS well_pipes;
DROP TABLE IF EXISTS well_pumps;
DROP TABLE IF EXISTS well_control_boxes;
DROP TABLE IF EXISTS well_logs;
DROP TABLE IF EXISTS maintenance_logs;
DROP TABLE IF EXISTS repair_records;
DROP TABLE IF EXISTS quotations;
DROP TABLE IF EXISTS repair_requests;
DROP TABLE IF EXISTS drilling_jobs;
DROP TABLE IF EXISTS drilling_requests;
DROP TABLE IF EXISTS wells;
DROP TABLE IF EXISTS line_notifications;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS technicians;
DROP TABLE IF EXISTS contractors;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS lithology_types;
DROP TABLE IF EXISTS maintenance_event_types;
DROP TABLE IF EXISTS pipe_types;

-- ============================================================
-- AUTH: users — ผู้ประกอบการ (login username/password, รายย่อย)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  user_id       INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  email         VARCHAR(150)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  full_name     VARCHAR(150)  NOT NULL,
  phone         VARCHAR(20)   NULL,
  role          VARCHAR(20)   NOT NULL DEFAULT 'USER',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CORE: customers — ลูกค้า
-- login ผ่าน LINE: เก็บ line_user_id + ชื่อ + รูปโปรไฟล์
-- user_id = NULL เมื่อผู้ประกอบการกรอกเอง (ไม่ผ่าน LINE)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  customer_id        INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id            INT UNSIGNED  NULL,
  line_user_id       VARCHAR(100)  NULL,
  customer_name      VARCHAR(150)  NOT NULL,
  phone              VARCHAR(20)   NOT NULL,
  phone_alt          VARCHAR(20)   NULL,
  address            TEXT          NULL,
  line_display_name  VARCHAR(150)  NULL,
  line_picture_url   VARCHAR(500)  NULL,
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id),
  UNIQUE KEY uq_customer_line_user (line_user_id),
  INDEX idx_customer_user   (user_id),
  INDEX idx_customer_phone  (phone),
  INDEX idx_customer_name   (customer_name(40)),
  CONSTRAINT fk_customers_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CORE: wells — บ่อบาดาล (สร้างเมื่อเจาะสำเร็จ / หรือกรอกเอง)
-- warranty_expire_date = completion_date + 2 ปี (generated column)
-- ============================================================
CREATE TABLE IF NOT EXISTS wells (
  well_id                INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  customer_id            INT UNSIGNED      NOT NULL,
  well_name              VARCHAR(150)      NOT NULL DEFAULT 'บ่อหลัก',
  address                TEXT              NULL,
  requested_depth_m      DECIMAL(7,2)      NULL,
  total_depth_m          DECIMAL(7,2)      NULL,
  drilling_method        ENUM('ROTARY','DTH','CABLE_TOOL','AUGER','JETTING','OTHER') NULL,
  formation_water_type   ENUM('FRESH','BRACKISH','SALINE','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  water_quantity_m3hr    DECIMAL(8,2)      NULL,
  yield_lpm              DECIMAL(8,2)      NULL,
  static_water_level_m   DECIMAL(7,2)      NULL,
  pumping_water_level_m  DECIMAL(7,2)      NULL,
  driller_name           VARCHAR(120)      NULL,
  completion_date        DATE              NULL,
  warranty_expire_date   DATE GENERATED ALWAYS AS (DATE_ADD(completion_date, INTERVAL 2 YEAR)) STORED
                         COMMENT 'AUTO: completion_date + 2 ปี',
  result                 ENUM('SUCCESS','FAIL') NOT NULL DEFAULT 'SUCCESS',
  failure_reason         TEXT              NULL,
  notes                  TEXT              NULL,
  created_at             TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (well_id),
  INDEX idx_wells_customer (customer_id),
  INDEX idx_wells_warranty (warranty_expire_date),
  CONSTRAINT fk_wells_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- WELL DETAIL: well_strata_logs — Geological Log (ชั้นดิน/หิน)
-- ============================================================
CREATE TABLE IF NOT EXISTS well_strata_logs (
  strata_id         INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  well_id           INT UNSIGNED      NOT NULL,
  depth_from_m      DECIMAL(7,2)      NOT NULL,
  depth_to_m        DECIMAL(7,2)      NOT NULL,
  lithology_type    ENUM('TOP_SOIL','CLAY','SAND','GRAVEL','LATERITE','SANDSTONE','SHALE','LIMESTONE','GRANITE','BASALT','HARDROCK','OTHER') NULL
                     COMMENT 'ประเภทดิน/หิน (dropdown)',
  lithology_name    VARCHAR(120)      NULL,
  color_hex         CHAR(7)           NULL,
  hardness          ENUM('VERY_SOFT','SOFT','MEDIUM','HARD','VERY_HARD') NULL,
  water_bearing     TINYINT(1)        NOT NULL DEFAULT 0,
  description       VARCHAR(255)      NULL,
  PRIMARY KEY (strata_id),
  INDEX idx_strata_well_depth (well_id, depth_from_m),
  CONSTRAINT fk_strata_well
    FOREIGN KEY (well_id) REFERENCES wells(well_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_strata_depth CHECK (depth_to_m > depth_from_m)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- WELL DETAIL: well_pipes — Pipe Specs (PVC/เหล็ก, ทึบ/เซาะร่อง)
-- ============================================================
CREATE TABLE IF NOT EXISTS well_pipes (
  pipe_id         INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  well_id         INT UNSIGNED      NOT NULL,
  material        ENUM('PVC','STEEL','STAINLESS_STEEL','HDPE','OTHER') NULL,
  pipe_type       ENUM('CASING','SCREEN') NULL,
  size_mm         DECIMAL(6,1)      NULL,
  depth_from_m    DECIMAL(7,2)      NOT NULL,
  depth_to_m      DECIMAL(7,2)      NOT NULL,
  quantity        INT UNSIGNED      NOT NULL DEFAULT 1,
  notes           TEXT              NULL,
  PRIMARY KEY (pipe_id),
  INDEX idx_pipes_well (well_id),
  CONSTRAINT fk_pipes_well
    FOREIGN KEY (well_id) REFERENCES wells(well_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_pipe_depth CHECK (depth_to_m > depth_from_m)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- WELL DETAIL: well_pumps — Pump Specs
-- ============================================================
CREATE TABLE IF NOT EXISTS well_pumps (
  pump_id              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  well_id              INT UNSIGNED      NOT NULL,
  pump_type            ENUM('AC_SUBMERSIBLE','DC_SOLAR_SUBMERSIBLE','OTHER') NULL,
  brand                VARCHAR(100)      NULL,
  pump_model           VARCHAR(100)      NULL
                       COMMENT 'รุ่นปั๊ม',
  horsepower           DECIMAL(5,2)      NULL,
  power_kw             DECIMAL(5,2)      NULL,
  impeller_stages      INT               NULL,
  installation_depth_m DECIMAL(7,2)      NULL
                       COMMENT 'ตำแหน่งที่หย่อน/แขวนปั๊ม (ม.)',
  voltage              VARCHAR(20)       NULL
                       COMMENT 'แรงดันไฟ (V)',
  phase                INT               NULL
                       COMMENT 'เฟส 1/3',
  discharge_size_mm    DECIMAL(6,1)      NULL
                       COMMENT 'ขนาดท่อจ่าย (มม.)',
  rated_flow_m3hr      DECIMAL(8,2)      NULL
                       COMMENT 'อัตราการไหลที่กำหนด (ม³/ชม.)',
  rated_head_m         DECIMAL(7,2)      NULL
                       COMMENT 'เฮดที่กำหนด (ม.)',
  installed_date       DATE              NULL,
  notes                TEXT              NULL,
  PRIMARY KEY (pump_id),
  INDEX idx_pumps_well (well_id),
  CONSTRAINT fk_pumps_well
    FOREIGN KEY (well_id) REFERENCES wells(well_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- WELL DETAIL: well_control_boxes — Control Box Specs
-- ============================================================
CREATE TABLE IF NOT EXISTS well_control_boxes (
  control_box_id  INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  well_id         INT UNSIGNED  NOT NULL,
  brand           VARCHAR(100)  NULL,
  model           VARCHAR(100)  NULL,
  capacity        VARCHAR(50)   NULL,
  voltage         VARCHAR(50)   NULL,
  protection_type ENUM('OVERLOAD_RELAY','CIRCUIT_BREAKER','AUTO_RESTART','WATER_LEVEL','LIGHTNING','NONE','OTHER') NULL
                   COMMENT 'ระบบป้องกันตู้คุมไฟ',
  features        VARCHAR(255)  NULL
                   COMMENT 'อุปกรณ์ในตู้ เช่น คอนแทคเตอร์ รีเลย์ ฯลฯ',
  installed_date  DATE          NULL,
  notes           TEXT          NULL,
  PRIMARY KEY (control_box_id),
  INDEX idx_control_boxes_well (well_id),
  CONSTRAINT fk_control_boxes_well
    FOREIGN KEY (well_id) REFERENCES wells(well_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- MASTER: pump_catalog_models — แคตตาล็อกปั๊มซับเมอร์ส (สำหรับ dropdown ยี่ห้อ → รุ่น)
-- ข้อมูล Franklin Electric + TORQUE ที่ import จากแคตตาล็อก
-- ค่าที่เป็นช่วง/เชิงพรรณนาเก็บเป็น VARCHAR เพื่อความเที่ยงตรง
-- ============================================================
CREATE TABLE IF NOT EXISTS pump_catalog_models (
  model_id          INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  brand             VARCHAR(50)        NOT NULL COMMENT 'ยี่ห้อ (FRANKLIN / TORQUE / ...)',
  series            VARCHAR(120)       NULL COMMENT 'ชื่อซีรีส์ เช่น 4" Tri Seal',
  model             VARCHAR(150)       NOT NULL COMMENT 'รุ่น/รหัสรุ่น',
  bore_size         VARCHAR(20)        NULL COMMENT 'ขนาดบ่อ (นิ้ว)',
  flow_rate         VARCHAR(80)        NULL COMMENT 'อัตราการไหล (LPM/gpm/m³/h)',
  motor_power       VARCHAR(80)        NULL COMMENT 'กำลังมอเตอร์ (HP / kW)',
  phase             VARCHAR(30)        NULL COMMENT 'เฟส / แรงดัน',
  discharge_size    VARCHAR(50)        NULL COMMENT 'ขนาดท่อจ่าย',
  impeller_stages   VARCHAR(50)        NULL COMMENT 'จำนวนใบพัด / สเตจ',
  max_head_m        VARCHAR(50)        NULL COMMENT 'เฮดส่งสูงสุด (ม.)',
  material          VARCHAR(120)       NULL COMMENT 'วัสดุ',
  features          VARCHAR(500)       NULL COMMENT 'จุดเด่น',
  reference_price   DECIMAL(12,2)      NULL COMMENT 'ราคาอ้างอิง (บาท)',
  notes             TEXT               NULL,
  sort_order        INT                NOT NULL DEFAULT 0,
  is_active         TINYINT(1)         NOT NULL DEFAULT 1,
  created_at        TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (model_id),
  INDEX idx_pump_catalog_brand (brand, is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- REQUEST: drilling_requests — คำร้องแจ้งเจาะ
-- source = GOOGLE_FORM (ลูกค้า) / MANUAL (ผู้ประกอบการกรอกเอง) / LINE
-- status: NEW → QUOTED → ACCEPTED | REJECTED | CANCELLED
-- ============================================================
CREATE TABLE IF NOT EXISTS drilling_requests (
  request_id         INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  customer_id        INT UNSIGNED       NOT NULL,
  source             ENUM('GOOGLE_FORM','MANUAL','LINE') NOT NULL DEFAULT 'GOOGLE_FORM',
  name               VARCHAR(150)       NOT NULL,
  phone              VARCHAR(20)        NOT NULL,
  address            TEXT               NOT NULL,
  requested_depth_m  DECIMAL(7,2)       NULL,
  appointment_date  DATE               NULL COMMENT 'วันนัดหมายที่ลูกค้ากรอก (LIFF)',
  status             ENUM('NEW','QUOTED','ACCEPTED','REJECTED','CANCELLED') NOT NULL DEFAULT 'NEW',
  notes              TEXT               NULL,
  created_at         TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (request_id),
  INDEX idx_drilling_req_customer (customer_id),
  INDEX idx_drilling_req_status  (status, created_at),
  CONSTRAINT fk_drilling_req_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- QUEUE: drilling_jobs — คิวงานเจาะ (Queue Pool, ไม่มีวันที่ตายตัว)
-- ลูกค้ายอมรับราคา → สร้าง job → QUEUED → DRILLING → SUCCESS | FAILED → CLOSED
-- ช่างเข้าผ่าน magic_link_token
-- ============================================================
CREATE TABLE IF NOT EXISTS drilling_jobs (
  job_id                 INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  request_id             INT UNSIGNED       NULL,
  customer_id            INT UNSIGNED       NOT NULL,
  well_id                INT UNSIGNED       NULL,
  status                 ENUM('QUEUED','DRILLING','SUCCESS','FAILED','CLOSED') NOT NULL DEFAULT 'QUEUED',
  result                 ENUM('SUCCESS','FAILED') NULL,
  failure_reason         TEXT               NULL,
  job_title              VARCHAR(200)       NULL,
  site_address           TEXT               NULL,
  province               VARCHAR(80)        NULL,
  district               VARCHAR(80)        NULL,
  scheduled_date         DATE               NULL,
  magic_link_token       VARCHAR(100)       NULL,
  magic_link_expires_at  DATETIME           NULL,
  notes                  TEXT               NULL,
  created_at             TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (job_id),
  UNIQUE KEY uq_job_magic_link (magic_link_token),
  INDEX idx_jobs_status     (status, created_at),
  INDEX idx_jobs_customer   (customer_id),
  CONSTRAINT fk_jobs_request
    FOREIGN KEY (request_id) REFERENCES drilling_requests(request_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_jobs_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_jobs_well
    FOREIGN KEY (well_id) REFERENCES wells(well_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- REQUEST: repair_requests — รายการแจ้งซ่อม (ฟอร์มเว็บของเรา)
-- problems = ปัญหาที่ติ๊ก (JSON array), photos = รูปที่แนบ (JSON array)
-- status: NEW → QUOTED → ACCEPTED → SCHEDULED → IN_PROGRESS → COMPLETED → CLOSED
--         | REJECTED | CANCELLED
-- ============================================================
CREATE TABLE IF NOT EXISTS repair_requests (
  repair_id            INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  customer_id          INT UNSIGNED       NOT NULL,
  well_id              INT UNSIGNED       NULL,
  problems             JSON               NOT NULL,
  detail               TEXT               NULL,
  photos               JSON               NULL,
  scheduled_date       DATE               NULL,
  status               ENUM('NEW','QUOTED','ACCEPTED','REJECTED','SCHEDULED','IN_PROGRESS','COMPLETED','CLOSED','CANCELLED') NOT NULL DEFAULT 'NEW',
  magic_link_token     VARCHAR(100)       NULL,
  magic_link_expires_at DATETIME          NULL,
  created_at           TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (repair_id),
  UNIQUE KEY uq_repair_magic_link (magic_link_token),
  INDEX idx_repair_customer (customer_id, created_at),
  INDEX idx_repair_status   (status),
  CONSTRAINT fk_repair_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_repair_well
    FOREIGN KEY (well_id) REFERENCES wells(well_id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- QUOTE: quotations — ราคาประเมิน (เจาะ/ซ่อม) + ยอมรับ/ปฏิเสธของลูกค้า
-- ============================================================
CREATE TABLE IF NOT EXISTS quotations (
  quotation_id        INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  kind                ENUM('DRILLING','REPAIR') NOT NULL,
  drilling_request_id INT UNSIGNED       NULL,
  repair_request_id   INT UNSIGNED       NULL,
  requested_depth_m   DECIMAL(7,2)       NULL COMMENT 'ความลึกที่ต้องการขุด (ม.)',
  requested_diameter_m DECIMAL(7,2)      NULL COMMENT 'ขนาดหน้าแปลนขุดเจาะ (ม.)',
  price               DECIMAL(12,2)      NOT NULL,
  status              ENUM('PENDING','ACCEPTED','REJECTED') NOT NULL DEFAULT 'PENDING',
  notes               TEXT               NULL,
  created_at          TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (quotation_id),
  INDEX idx_quotes_drilling (drilling_request_id),
  INDEX idx_quotes_repair   (repair_request_id),
  INDEX idx_quotes_status   (status),
  CONSTRAINT fk_quotes_drilling
    FOREIGN KEY (drilling_request_id) REFERENCES drilling_requests(request_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_quotes_repair
    FOREIGN KEY (repair_request_id) REFERENCES repair_requests(repair_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_quote_target CHECK (
    (kind = 'DRILLING' AND drilling_request_id IS NOT NULL AND repair_request_id IS NULL)
    OR
    (kind = 'REPAIR' AND repair_request_id IS NOT NULL AND drilling_request_id IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- RECORD: repair_records — ช่างบันทึกหลังซ่อมเสร็จ
-- parts = รายการอะไหล่ (JSON array)
-- pump  = ข้อมูลปั๊มที่ติดตั้ง/เปลี่ยนระหว่างซ่อม (JSON: จากการเลือกแคตตาล็อก)
-- ============================================================
CREATE TABLE IF NOT EXISTS repair_records (
  record_id         INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  repair_id         INT UNSIGNED       NOT NULL,
  final_price       DECIMAL(12,2)      NULL,
  work_details      TEXT               NULL,
  parts             JSON               NULL,
  pump              JSON               NULL,
  is_warranty_claim TINYINT(1)         NOT NULL DEFAULT 0,
  completed_at      DATETIME           NULL,
  created_at        TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (record_id),
  INDEX idx_repair_records_repair (repair_id),
  CONSTRAINT fk_repair_records_repair
    FOREIGN KEY (repair_id) REFERENCES repair_requests(repair_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- LINE: line_notifications — log การส่งข้อความกลับ LINE ถึงลูกค้า
-- ============================================================
CREATE TABLE IF NOT EXISTS line_notifications (
  notification_id  INT UNSIGNED       NOT NULL AUTO_INCREMENT,
  customer_id      INT UNSIGNED       NULL,
  kind             ENUM('QUOTE','STATUS','REMINDER','OTHER') NULL,
  content          TEXT               NULL,
  line_message_id  VARCHAR(100)       NULL,
  status           ENUM('SENT','FAILED') NOT NULL DEFAULT 'SENT',
  sent_at          TIMESTAMP          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notification_id),
  INDEX idx_notifications_customer (customer_id, sent_at),
  CONSTRAINT fk_notifications_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- VIEW: well_warranty_view — สถานะประกัน (สำหรับ LINE bot / Dashboard)
-- ============================================================
CREATE OR REPLACE VIEW well_warranty_view AS
SELECT
  w.well_id,
  w.well_name,
  w.customer_id,
  c.customer_name,
  c.line_user_id,
  w.completion_date,
  w.warranty_expire_date,
  DATEDIFF(w.warranty_expire_date, CURDATE()) AS days_left,
  CASE
    WHEN w.warranty_expire_date IS NULL THEN 'UNKNOWN'
    WHEN w.warranty_expire_date >= CURDATE() THEN 'ACTIVE'
    ELSE 'EXPIRED'
  END AS warranty_status
FROM wells w
JOIN customers c ON c.customer_id = w.customer_id;
