SET NAMES utf8mb4;
-- ============================================================
-- ระบบจัดการบ่อบาดาล (DGWM) — Database Schema v3
-- MySQL 8.0+ | utf8mb4 | InnoDB | 3NF Normalized
-- ============================================================

CREATE DATABASE IF NOT EXISTS well_drilling
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE well_drilling;

-- ============================================================
-- LOOKUP: lithology_types
-- ============================================================
CREATE TABLE IF NOT EXISTS lithology_types (
  type_id       TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type_name     VARCHAR(80)      NOT NULL,
  type_name_th  VARCHAR(120)     NOT NULL,
  color_hex     CHAR(7)          NOT NULL DEFAULT '#A0856C',
  pattern       VARCHAR(40)      NOT NULL DEFAULT 'solid',
  description   TEXT             NULL,
  created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (type_id),
  UNIQUE KEY uq_lithology_name (type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- LOOKUP: pipe_types
-- ============================================================
CREATE TABLE IF NOT EXISTS pipe_types (
  type_id      TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type_name    VARCHAR(80)      NOT NULL,
  material     ENUM('PVC','STEEL','STAINLESS_STEEL','HDPE','OTHER') NOT NULL DEFAULT 'PVC',
  is_screen    TINYINT(1)       NOT NULL DEFAULT 0,
  description  TEXT             NULL,
  created_at   TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (type_id),
  UNIQUE KEY uq_pipe_type_name (type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- LOOKUP: maintenance_event_types
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_event_types (
  event_type_id TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type_name     VARCHAR(80)      NOT NULL,
  type_name_th  VARCHAR(120)     NOT NULL,
  description   TEXT             NULL,
  created_at    TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (event_type_id),
  UNIQUE KEY uq_event_type_name (type_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CORE: customers
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  customer_id   INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED  NOT NULL,
  customer_name VARCHAR(150)  NOT NULL,
  phone         VARCHAR(20)   NOT NULL,
  phone_alt     VARCHAR(20)   NULL,
  address       TEXT          NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id),
  INDEX idx_customer_user     (user_id),
  INDEX idx_customer_name     (customer_name(40)),
  INDEX idx_phone             (phone),
  CONSTRAINT fk_customers_user
    FOREIGN KEY (user_id) REFERENCES users(user_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CORE: drilling_jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS drilling_jobs (
  job_id              INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  job_reference       VARCHAR(20)       NOT NULL,
  customer_id         INT UNSIGNED      NOT NULL,
  job_title           VARCHAR(200)      NOT NULL,
  site_address        TEXT              NOT NULL,
  province            VARCHAR(80)       NOT NULL DEFAULT '',
  district            VARCHAR(80)       NOT NULL DEFAULT '',
  latitude            DECIMAL(10,8)     NULL,
  longitude           DECIMAL(11,8)     NULL,
  scheduled_date      DATE              NOT NULL,
  requested_depth_m   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status              ENUM('PENDING','DRILLING','COMPLETED','ARCHIVED') NOT NULL DEFAULT 'PENDING',
  priority            ENUM('NORMAL','HIGH','URGENT') NOT NULL DEFAULT 'NORMAL',
  notes               TEXT              NULL,
  created_at          TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (job_id),
  UNIQUE KEY uq_job_reference    (job_reference),
  INDEX idx_status_priority      (status, priority, created_at),
  INDEX idx_province_status      (province(30), status),
  CONSTRAINT fk_jobs_customer
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CORE: well_logs — 1:1 กับ drilling_jobs
-- warranty_expire_date = STORED GENERATED COLUMN
-- ============================================================
CREATE TABLE IF NOT EXISTS well_logs (
  well_id               INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  job_id                INT UNSIGNED  NOT NULL,
  total_depth           DECIMAL(6,2)  NOT NULL,
  casing_depth          DECIMAL(6,2)  NULL,
  water_quantity        DECIMAL(8,2)  NOT NULL DEFAULT 0,
  yield_lpm             DECIMAL(8,2)  NULL,
  static_water_level    DECIMAL(6,2)  NOT NULL DEFAULT 0,
  pumping_water_level   DECIMAL(6,2)  NOT NULL DEFAULT 0,
  pump_depth            DECIMAL(6,2)  NULL,
  pump_power_kw         DECIMAL(5,2)  NULL,
  pump_brand            VARCHAR(100)  NULL,
  pump_type             ENUM('AC_SUBMERSIBLE','DC_SOLAR_SUBMERSIBLE','OTHER') NULL,
  drilling_method       ENUM('ROTARY','DTH','CABLE_TOOL','AUGER','JETTING','OTHER') NULL,
  formation_water_type  ENUM('FRESH','BRACKISH','SALINE','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
  driller_name          VARCHAR(120)  NULL,
  completion_date       DATE          NOT NULL,
  warranty_expire_date  DATE          GENERATED ALWAYS AS (DATE_ADD(completion_date, INTERVAL 2 YEAR)) STORED
                        COMMENT 'AUTO-GENERATED: completion_date + 2 ปี',
  gps_accuracy_m        DECIMAL(5,1)  NULL,
  notes                 TEXT          NULL,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (well_id),
  UNIQUE KEY uq_well_job         (job_id),
  INDEX idx_completion_date      (completion_date),
  INDEX idx_warranty_expire      (warranty_expire_date),
  CONSTRAINT fk_well_logs_job
    FOREIGN KEY (job_id) REFERENCES drilling_jobs(job_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CORE: well_strata_logs — 1:Many กับ well_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS well_strata_logs (
  strata_id          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  well_id            INT UNSIGNED     NOT NULL,
  lithology_type_id  TINYINT UNSIGNED NOT NULL,
  depth_from         DECIMAL(6,2)     NOT NULL,
  depth_to           DECIMAL(6,2)     NOT NULL,
  color_override     CHAR(7)          NULL,
  hardness           ENUM('VERY_SOFT','SOFT','MEDIUM','HARD','VERY_HARD') NULL,
  rqd_percent        TINYINT UNSIGNED NULL,
  is_water_bearing   TINYINT(1)       NOT NULL DEFAULT 0,
  conductivity_us    DECIMAL(8,2)     NULL,
  ph_value           DECIMAL(4,2)     NULL,
  tds_ppm            DECIMAL(8,2)     NULL,
  description        VARCHAR(255)     NULL,
  PRIMARY KEY (strata_id),
  INDEX idx_strata_depth (well_id, depth_from),
  CONSTRAINT fk_strata_well
    FOREIGN KEY (well_id) REFERENCES well_logs(well_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_strata_lithology
    FOREIGN KEY (lithology_type_id) REFERENCES lithology_types(type_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_strata_depth CHECK (depth_to > depth_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CORE: well_pipes — 1:Many กับ well_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS well_pipes (
  pipe_id           INT UNSIGNED      NOT NULL AUTO_INCREMENT,
  well_id           INT UNSIGNED      NOT NULL,
  pipe_type_id      TINYINT UNSIGNED  NULL,
  pipe_type         ENUM('CASING_PVC','SCREEN_PVC','CASING_STEEL','SCREEN_STEEL') NULL,
  pipe_size         ENUM('4_INCH','5_INCH','6_INCH','8_INCH') NOT NULL,
  thickness_class   ENUM('CLASS_8.5','CLASS_13.5','STEEL_STANDARD','NONE') DEFAULT 'NONE',
  diameter_mm       DECIMAL(6,1)      NULL,
  wall_thickness_mm DECIMAL(5,2)      NULL,
  depth_from        DECIMAL(6,2)      NOT NULL,
  depth_to          DECIMAL(6,2)      NOT NULL,
  quantity          SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  joint_length_m    DECIMAL(5,2)      NOT NULL DEFAULT 3.00,
  notes             TEXT              NULL,
  PRIMARY KEY (pipe_id),
  INDEX idx_pipe_depth (well_id, depth_from),
  CONSTRAINT fk_pipe_well
    FOREIGN KEY (well_id) REFERENCES well_logs(well_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pipe_type_lkp
    FOREIGN KEY (pipe_type_id) REFERENCES pipe_types(type_id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_pipe_depth CHECK (depth_to > depth_from)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CORE: well_pumps — 1:Many กับ well_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS well_pumps (
  pump_id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  well_id            INT UNSIGNED  NOT NULL,
  pump_type          ENUM('AC_SUBMERSIBLE','DC_SOLAR_SUBMERSIBLE','OTHER') NOT NULL,
  brand              VARCHAR(100)  NULL,
  horsepower         DECIMAL(5,2)  NOT NULL DEFAULT 0,
  power_kw           DECIMAL(5,2)  NULL,
  impeller_stages    INT           NULL,
  installation_depth DECIMAL(6,2)  NOT NULL DEFAULT 0,
  installed_date     DATE          NOT NULL,
  notes              TEXT          NULL,
  PRIMARY KEY (pump_id),
  INDEX idx_pump_well (well_id),
  CONSTRAINT fk_pump_well
    FOREIGN KEY (well_id) REFERENCES well_logs(well_id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- CORE: maintenance_logs — 1:Many กับ well_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS maintenance_logs (
  maintenance_id    INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  well_id           INT UNSIGNED     NOT NULL,
  event_type_id     TINYINT UNSIGNED NOT NULL,
  event_date        DATE             NOT NULL,
  description       TEXT             NOT NULL,
  performed_by      VARCHAR(120)     NOT NULL,
  next_service_date DATE             NULL,
  is_warranty_claim TINYINT(1)       NOT NULL DEFAULT 0,
  created_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (maintenance_id),
  INDEX idx_maintenance_well_date (well_id, event_date DESC),
  INDEX idx_next_service          (next_service_date),
  CONSTRAINT fk_maintenance_well
    FOREIGN KEY (well_id) REFERENCES well_logs(well_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_maintenance_type
    FOREIGN KEY (event_type_id) REFERENCES maintenance_event_types(event_type_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- AUTH: users — ระบบยืนยันตัวตน
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  user_id       INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  email         VARCHAR(150)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  full_name     VARCHAR(150)  NOT NULL,
  role          ENUM('ADMIN','DRILLER') NOT NULL DEFAULT 'DRILLER',
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
