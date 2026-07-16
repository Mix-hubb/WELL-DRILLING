# Database Schema — ระบบจัดการบ่อบาดาล (DGWM)

> MySQL 8.0 | Database: `well_drilling` | Character Set: `utf8mb4`

---

## ER Diagram

```mermaid
erDiagram

    users {
        INT UNSIGNED user_id PK "AUTO_INCREMENT"
        VARCHAR(150) email UK "NOT NULL"
        VARCHAR(255) password_hash "NOT NULL"
        VARCHAR(150) full_name "NOT NULL"
        ENUM role "ADMIN | DRILLER"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    customers {
        INT UNSIGNED customer_id PK "AUTO_INCREMENT"
        INT UNSIGNED user_id FK "NOT NULL"
        VARCHAR(150) customer_name "NOT NULL"
        VARCHAR(20) phone "NOT NULL"
        VARCHAR(20) phone_alt "NULL"
        TEXT address "NULL"
        TIMESTAMP created_at
    }

    drilling_jobs {
        INT UNSIGNED job_id PK "AUTO_INCREMENT"
        VARCHAR(20) job_reference UK "NOT NULL"
        INT UNSIGNED customer_id FK "NOT NULL"
        VARCHAR(200) job_title "NOT NULL"
        TEXT site_address "NOT NULL"
        VARCHAR(80) province "DEFAULT ''"
        VARCHAR(80) district "DEFAULT ''"
        DECIMAL(10,8) latitude "NULL"
        DECIMAL(11,8) longitude "NULL"
        DATE scheduled_date "NOT NULL"
        SMALLINT UNSIGNED requested_depth_m "DEFAULT 0"
        ENUM status "PENDING|DRILLING|COMPLETED|ARCHIVED"
        ENUM priority "NORMAL|HIGH|URGENT"
        TEXT notes "NULL"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    well_logs {
        INT UNSIGNED well_id PK "AUTO_INCREMENT"
        INT UNSIGNED job_id FK UK "NOT NULL"
        DECIMAL(6,2) total_depth "NOT NULL"
        DECIMAL(6,2) casing_depth "NULL"
        DECIMAL(8,2) water_quantity "DEFAULT 0"
        DECIMAL(8,2) yield_lpm "NULL"
        DECIMAL(6,2) static_water_level "DEFAULT 0"
        DECIMAL(6,2) pumping_water_level "DEFAULT 0"
        DECIMAL(6,2) pump_depth "NULL"
        DECIMAL(5,2) pump_power_kw "NULL"
        VARCHAR(100) pump_brand "NULL"
        ENUM pump_type "AC_SUBMERSIBLE|DC_SOLAR|OTHER"
        ENUM drilling_method "ROTARY|DTH|CABLE_TOOL|AUGER|JETTING|OTHER"
        ENUM formation_water_type "FRESH|BRACKISH|SALINE|UNKNOWN"
        VARCHAR(120) driller_name "NULL"
        DATE completion_date "NOT NULL"
        DATE warranty_expire_date "GENERATED"
        DECIMAL(5,1) gps_accuracy_m "NULL"
        TEXT notes "NULL"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    well_strata_logs {
        INT UNSIGNED strata_id PK "AUTO_INCREMENT"
        INT UNSIGNED well_id FK "NOT NULL"
        TINYINT UNSIGNED lithology_type_id FK "NOT NULL"
        DECIMAL(6,2) depth_from "NOT NULL"
        DECIMAL(6,2) depth_to "NOT NULL"
        CHAR(7) color_override "NULL"
        ENUM hardness "VERY_SOFT|SOFT|MEDIUM|HARD|VERY_HARD"
        TINYINT UNSIGNED rqd_percent "NULL"
        TINYINT is_water_bearing "DEFAULT 0"
        DECIMAL(8,2) conductivity_us "NULL"
        DECIMAL(4,2) ph_value "NULL"
        DECIMAL(8,2) tds_ppm "NULL"
        VARCHAR(255) description "NULL"
    }

    well_pipes {
        INT UNSIGNED pipe_id PK "AUTO_INCREMENT"
        INT UNSIGNED well_id FK "NOT NULL"
        TINYINT UNSIGNED pipe_type_id FK "NULL"
        ENUM pipe_type "CASING_PVC|SCREEN_PVC|CASING_STEEL|SCREEN_STEEL"
        ENUM pipe_size "4_INCH|5_INCH|6_INCH|8_INCH"
        ENUM thickness_class "CLASS_8_5|CLASS_13_5|STEEL_STANDARD|NONE"
        DECIMAL(6,1) diameter_mm "NULL"
        DECIMAL(5,2) wall_thickness_mm "NULL"
        DECIMAL(6,2) depth_from "NOT NULL"
        DECIMAL(6,2) depth_to "NOT NULL"
        SMALLINT UNSIGNED quantity "DEFAULT 1"
        DECIMAL(5,2) joint_length_m "DEFAULT 3.00"
        TEXT notes "NULL"
    }

    well_pumps {
        INT UNSIGNED pump_id PK "AUTO_INCREMENT"
        INT UNSIGNED well_id FK "NOT NULL"
        ENUM pump_type "AC_SUBMERSIBLE|DC_SOLAR|OTHER"
        VARCHAR(100) brand "NULL"
        DECIMAL(5,2) horsepower "DEFAULT 0"
        DECIMAL(5,2) power_kw "NULL"
        INT impeller_stages "NULL"
        DECIMAL(6,2) installation_depth "DEFAULT 0"
        DATE installed_date "NOT NULL"
        TEXT notes "NULL"
    }

    maintenance_logs {
        INT UNSIGNED maintenance_id PK "AUTO_INCREMENT"
        INT UNSIGNED well_id FK "NOT NULL"
        TINYINT UNSIGNED event_type_id FK "NOT NULL"
        DATE event_date "NOT NULL"
        TEXT description "NOT NULL"
        VARCHAR(120) performed_by "NOT NULL"
        DATE next_service_date "NULL"
        TINYINT is_warranty_claim "DEFAULT 0"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    lithology_types {
        TINYINT UNSIGNED type_id PK "AUTO_INCREMENT"
        VARCHAR(80) type_name UK "NOT NULL"
        VARCHAR(120) type_name_th "NOT NULL"
        CHAR(7) color_hex "DEFAULT '#A0856C'"
        VARCHAR(40) pattern "DEFAULT 'solid'"
        TEXT description "NULL"
        TIMESTAMP created_at
    }

    pipe_types {
        TINYINT UNSIGNED type_id PK "AUTO_INCREMENT"
        VARCHAR(80) type_name UK "NOT NULL"
        ENUM material "PVC|STEEL|SS|HDPE|OTHER"
        TINYINT is_screen "DEFAULT 0"
        TEXT description "NULL"
        TIMESTAMP created_at
    }

    maintenance_event_types {
        TINYINT UNSIGNED event_type_id PK "AUTO_INCREMENT"
        VARCHAR(80) type_name UK "NOT NULL"
        VARCHAR(120) type_name_th "NOT NULL"
        TEXT description "NULL"
        TIMESTAMP created_at
    }

    users ||--o{ customers : "สร้าง"
    customers ||--o{ drilling_jobs : "ว่าจ้าง"
    drilling_jobs ||--|| well_logs : "1:1"
    well_logs ||--o{ well_strata_logs : "ชั้นดิน"
    well_logs ||--o{ well_pipes : "ท่อ"
    well_logs ||--o{ well_pumps : "ปั๊ม"
    well_logs ||--o{ maintenance_logs : "ซ่อมบำรุง"
    lithology_types ||--o{ well_strata_logs : "ประเภท"
    pipe_types ||--o{ well_pipes : "ประเภท"
    maintenance_event_types ||--o{ maintenance_logs : "ประเภท"
```

---

## Relationship Summary

```
users (1) ──── (M) customers            FK: customers.user_id → users.user_id
customers (1) ──── (M) drilling_jobs     FK: drilling_jobs.customer_id → customers.customer_id
drilling_jobs (1) ──── (1) well_logs     FK: well_logs.job_id → drilling_jobs.job_id [UNIQUE → 1:1]
well_logs (1) ──── (M) well_strata_logs  FK: well_strata_logs.well_id → well_logs.well_id
well_logs (1) ──── (M) well_pipes        FK: well_pipes.well_id → well_logs.well_id
well_logs (1) ──── (M) well_pumps        FK: well_pumps.well_id → well_logs.well_id
well_logs (1) ──── (M) maintenance_logs  FK: maintenance_logs.well_id → well_logs.well_id
lithology_types (1) ──── (M) well_strata_logs  FK: well_strata_logs.lithology_type_id
pipe_types (1) ──── (M) well_pipes       FK: well_pipes.pipe_type_id → pipe_types.type_id
maintenance_event_types (1) ──── (M) maintenance_logs  FK: maintenance_logs.event_type_id
```

---

## Table: `users`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `user_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | |
| `email` | `VARCHAR(150)` | NOT NULL, UNIQUE | Login identifier |
| `password_hash` | `VARCHAR(255)` | NOT NULL | bcrypt hash |
| `full_name` | `VARCHAR(150)` | NOT NULL | Display name |
| `role` | `ENUM('ADMIN','DRILLER')` | NOT NULL, DEFAULT 'DRILLER' | Data scope |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | ON UPDATE CURRENT_TIMESTAMP | |

---

## Table: `customers`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `customer_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | |
| `user_id` | `INT UNSIGNED` | NOT NULL, FK → users | Owner (data isolation) |
| `customer_name` | `VARCHAR(150)` | NOT NULL, INDEX | |
| `phone` | `VARCHAR(20)` | NOT NULL, INDEX | |
| `phone_alt` | `VARCHAR(20)` | NULL | |
| `address` | `TEXT` | NULL | |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |

---

## Table: `drilling_jobs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `job_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | |
| `job_reference` | `VARCHAR(20)` | NOT NULL, UNIQUE | Auto: WEL-YYYY-NNNN |
| `customer_id` | `INT UNSIGNED` | NOT NULL, FK → customers | |
| `job_title` | `VARCHAR(200)` | NOT NULL | |
| `site_address` | `TEXT` | NOT NULL | |
| `province` | `VARCHAR(80)` | DEFAULT '' | |
| `district` | `VARCHAR(80)` | DEFAULT '' | |
| `latitude` | `DECIMAL(10,8)` | NULL | |
| `longitude` | `DECIMAL(11,8)` | NULL | |
| `scheduled_date` | `DATE` | NOT NULL | |
| `requested_depth_m` | `SMALLINT UNSIGNED` | DEFAULT 0 | Meters |
| `status` | `ENUM('PENDING','DRILLING','COMPLETED','ARCHIVED')` | DEFAULT 'PENDING' | |
| `priority` | `ENUM('NORMAL','HIGH','URGENT')` | DEFAULT 'NORMAL' | |
| `notes` | `TEXT` | NULL | |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | ON UPDATE CURRENT_TIMESTAMP | |

**Indexes:** `idx_status_priority (status, priority, created_at)`, `idx_province_status (province(30), status)`

---

## Table: `well_logs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `well_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | |
| `job_id` | `INT UNSIGNED` | NOT NULL, UNIQUE, FK → drilling_jobs | 1:1 relationship |
| `total_depth` | `DECIMAL(6,2)` | NOT NULL | Meters |
| `casing_depth` | `DECIMAL(6,2)` | NULL | |
| `water_quantity` | `DECIMAL(8,2)` | DEFAULT 0 | m³/hr |
| `yield_lpm` | `DECIMAL(8,2)` | NULL | Liters/min |
| `static_water_level` | `DECIMAL(6,2)` | DEFAULT 0 | Meters |
| `pumping_water_level` | `DECIMAL(6,2)` | DEFAULT 0 | Meters |
| `pump_depth` | `DECIMAL(6,2)` | NULL | |
| `pump_power_kw` | `DECIMAL(5,2)` | NULL | |
| `pump_brand` | `VARCHAR(100)` | NULL | |
| `pump_type` | `ENUM('AC_SUBMERSIBLE','DC_SOLAR_SUBMERSIBLE','OTHER')` | NULL | |
| `drilling_method` | `ENUM('ROTARY','DTH','CABLE_TOOL','AUGER','JETTING','OTHER')` | NULL | |
| `formation_water_type` | `ENUM('FRESH','BRACKISH','SALINE','UNKNOWN')` | DEFAULT 'UNKNOWN' | |
| `driller_name` | `VARCHAR(120)` | NULL | |
| `completion_date` | `DATE` | NOT NULL, INDEX | |
| `warranty_expire_date` | `DATE` | GENERATED STORED | `DATE_ADD(completion_date, INTERVAL 2 YEAR)` |
| `gps_accuracy_m` | `DECIMAL(5,1)` | NULL | |
| `notes` | `TEXT` | NULL | |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | ON UPDATE CURRENT_TIMESTAMP | |

**Indexes:** `idx_completion_date`, `idx_warranty_expire`

---

## Table: `well_strata_logs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `strata_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | |
| `well_id` | `INT UNSIGNED` | NOT NULL, FK → well_logs | CASCADE on delete |
| `lithology_type_id` | `TINYINT UNSIGNED` | NOT NULL, FK → lithology_types | RESTRICT on delete |
| `depth_from` | `DECIMAL(6,2)` | NOT NULL | Meters |
| `depth_to` | `DECIMAL(6,2)` | NOT NULL, CHECK (depth_to > depth_from) | |
| `color_override` | `CHAR(7)` | NULL | Optional hex |
| `hardness` | `ENUM('VERY_SOFT','SOFT','MEDIUM','HARD','VERY_HARD')` | NULL | |
| `rqd_percent` | `TINYINT UNSIGNED` | NULL | Rock Quality Designation |
| `is_water_bearing` | `TINYINT(1)` | DEFAULT 0 | Boolean |
| `conductivity_us` | `DECIMAL(8,2)` | NULL | µS/cm |
| `ph_value` | `DECIMAL(4,2)` | NULL | |
| `tds_ppm` | `DECIMAL(8,2)` | NULL | Total Dissolved Solids |
| `description` | `VARCHAR(255)` | NULL | |

**Indexes:** `idx_strata_depth (well_id, depth_from)`

---

## Table: `well_pipes`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `pipe_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | |
| `well_id` | `INT UNSIGNED` | NOT NULL, FK → well_logs | CASCADE on delete |
| `pipe_type_id` | `TINYINT UNSIGNED` | NULL, FK → pipe_types | SET NULL on delete |
| `pipe_type` | `ENUM('CASING_PVC','SCREEN_PVC','CASING_STEEL','SCREEN_STEEL')` | NULL | Legacy |
| `pipe_size` | `ENUM('4_INCH','5_INCH','6_INCH','8_INCH')` | NOT NULL | |
| `thickness_class` | `ENUM('CLASS_8_5','CLASS_13_5','STEEL_STANDARD','NONE')` | DEFAULT 'NONE' | |
| `diameter_mm` | `DECIMAL(6,1)` | NULL | |
| `wall_thickness_mm` | `DECIMAL(5,2)` | NULL | |
| `depth_from` | `DECIMAL(6,2)` | NOT NULL | |
| `depth_to` | `DECIMAL(6,2)` | NOT NULL, CHECK (depth_to > depth_from) | |
| `quantity` | `SMALLINT UNSIGNED` | DEFAULT 1 | |
| `joint_length_m` | `DECIMAL(5,2)` | DEFAULT 3.00 | |
| `notes` | `TEXT` | NULL | |

**Indexes:** `idx_pipe_depth (well_id, depth_from)`

---

## Table: `well_pumps`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `pump_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | |
| `well_id` | `INT UNSIGNED` | NOT NULL, FK → well_logs | CASCADE on delete |
| `pump_type` | `ENUM('AC_SUBMERSIBLE','DC_SOLAR_SUBMERSIBLE','OTHER')` | NOT NULL | |
| `brand` | `VARCHAR(100)` | NULL | |
| `horsepower` | `DECIMAL(5,2)` | DEFAULT 0 | |
| `power_kw` | `DECIMAL(5,2)` | NULL | |
| `impeller_stages` | `INT` | NULL | |
| `installation_depth` | `DECIMAL(6,2)` | DEFAULT 0 | Meters |
| `installed_date` | `DATE` | NOT NULL | |
| `notes` | `TEXT` | NULL | |

**Indexes:** `idx_pump_well (well_id)`

---

## Table: `maintenance_logs`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `maintenance_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | |
| `well_id` | `INT UNSIGNED` | NOT NULL, FK → well_logs | CASCADE on delete |
| `event_type_id` | `TINYINT UNSIGNED` | NOT NULL, FK → maintenance_event_types | RESTRICT on delete |
| `event_date` | `DATE` | NOT NULL | |
| `description` | `TEXT` | NOT NULL | |
| `performed_by` | `VARCHAR(120)` | NOT NULL | |
| `next_service_date` | `DATE` | NULL, INDEX | |
| `is_warranty_claim` | `TINYINT(1)` | DEFAULT 0 | Boolean |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | ON UPDATE CURRENT_TIMESTAMP | |

**Indexes:** `idx_maintenance_well_date (well_id, event_date DESC)`, `idx_next_service (next_service_date)`

---

## Table: `lithology_types` (Lookup)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `type_id` | `TINYINT UNSIGNED` | PK, AUTO_INCREMENT | |
| `type_name` | `VARCHAR(80)` | NOT NULL, UNIQUE | English name |
| `type_name_th` | `VARCHAR(120)` | NOT NULL | Thai name |
| `color_hex` | `CHAR(7)` | DEFAULT '#A0856C' | SVG color |
| `pattern` | `VARCHAR(40)` | DEFAULT 'solid' | solid/hatched/dotted/crossed |
| `description` | `TEXT` | NULL | |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |

**Seed data (10 types):** Bangkok Clay, Silty Sand, Weathered Granite, Fresh Granite, Laterite, Clayey Sand, Gravel, Limestone, Sandstone, Sandy Clay

---

## Table: `pipe_types` (Lookup)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `type_id` | `TINYINT UNSIGNED` | PK, AUTO_INCREMENT | |
| `type_name` | `VARCHAR(80)` | NOT NULL, UNIQUE | |
| `material` | `ENUM('PVC','STEEL','STAINLESS_STEEL','HDPE','OTHER')` | DEFAULT 'PVC' | |
| `is_screen` | `TINYINT(1)` | DEFAULT 0 | 1 = screen pipe |
| `description` | `TEXT` | NULL | |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |

**Seed data (6 types):** PVC Class 13.5 (6"), PVC Slotted Screen 6", Mild Steel 6", Mild Steel 8", PVC Class 13.5 (4"), SS316 Screen 4"

---

## Table: `maintenance_event_types` (Lookup)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `event_type_id` | `TINYINT UNSIGNED` | PK, AUTO_INCREMENT | |
| `type_name` | `VARCHAR(80)` | NOT NULL, UNIQUE | English |
| `type_name_th` | `VARCHAR(120)` | NOT NULL | Thai |
| `description` | `TEXT` | NULL | |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |

**Seed data (6 types):** Pump Replacement, Well Cleaning, Electrical Inspection, Sensor Repair, Annual Inspection, Valve Replacement

---

## Foreign Key Summary

| FK Name | Child Table.Column | Parent Table.Column | ON DELETE | ON UPDATE |
|---------|-------------------|---------------------|-----------|-----------|
| `fk_customers_user` | `customers.user_id` | `users.user_id` | RESTRICT | CASCADE |
| `fk_jobs_customer` | `drilling_jobs.customer_id` | `customers.customer_id` | RESTRICT | CASCADE |
| `fk_well_logs_job` | `well_logs.job_id` | `drilling_jobs.job_id` | CASCADE | CASCADE |
| `fk_strata_well` | `well_strata_logs.well_id` | `well_logs.well_id` | CASCADE | CASCADE |
| `fk_strata_lithology` | `well_strata_logs.lithology_type_id` | `lithology_types.type_id` | RESTRICT | CASCADE |
| `fk_pipe_well` | `well_pipes.well_id` | `well_logs.well_id` | CASCADE | CASCADE |
| `fk_pipe_type_lkp` | `well_pipes.pipe_type_id` | `pipe_types.type_id` | SET NULL | CASCADE |
| `fk_pump_well` | `well_pumps.well_id` | `well_logs.well_id` | CASCADE | CASCADE |
| `fk_maintenance_well` | `maintenance_logs.well_id` | `well_logs.well_id` | CASCADE | CASCADE |
| `fk_maintenance_type` | `maintenance_logs.event_type_id` | `maintenance_event_types.event_type_id` | RESTRICT | CASCADE |

---

## Index Summary

| Table | Index Name | Columns | Type |
|-------|-----------|---------|------|
| `customers` | `idx_customer_user` | `user_id` | Non-unique |
| `customers` | `idx_customer_name` | `customer_name(40)` | Non-unique |
| `customers` | `idx_phone` | `phone` | Non-unique |
| `drilling_jobs` | `idx_status_priority` | `status, priority, created_at` | Composite |
| `drilling_jobs` | `idx_province_status` | `province(30), status` | Composite |
| `well_logs` | `idx_completion_date` | `completion_date` | Non-unique |
| `well_logs` | `idx_warranty_expire` | `warranty_expire_date` | Non-unique |
| `well_strata_logs` | `idx_strata_depth` | `well_id, depth_from` | Composite |
| `well_pipes` | `idx_pipe_depth` | `well_id, depth_from` | Composite |
| `well_pumps` | `idx_pump_well` | `well_id` | Non-unique |
| `maintenance_logs` | `idx_maintenance_well_date` | `well_id, event_date DESC` | Composite |
| `maintenance_logs` | `idx_next_service` | `next_service_date` | Non-unique |

---

## CHECK Constraints

| Table | Constraint | Expression |
|-------|-----------|------------|
| `well_strata_logs` | `chk_strata_depth` | `depth_to > depth_from` |
| `well_pipes` | `chk_pipe_depth` | `depth_to > depth_from` |

---

## Data Isolation (Role-Based)

| Role | Behavior | Implementation |
|------|----------|----------------|
| **ADMIN** | Sees ALL data across all users | `userFilter()` returns empty string |
| **DRILLER** | Sees only own data (via `customers.user_id`) | `userFilter()` appends `AND c.user_id = ?` |

Applied in: `customers.controller`, `jobs.controller`, `wells.controller`, `stats.controller`, `warranty.controller`, `maintenance.controller`
