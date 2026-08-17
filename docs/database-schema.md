# Database Schema — ระบบจัดการบ่อบาดาลดิจิทัล

> MySQL 8.0 | Database: `well_drilling` | Character Set: `utf8mb4`
> อัปเดตล่าสุดให้ตรงกับ docs/project-info.md (Flow A/B/C + LINE)
> หมายเหตุ: ไม่มี GPS ในระบบ — ไม่มีคอลัมน์ latitude/longitude/gps_accuracy_m

---

## ER Diagram

```mermaid
erDiagram

    users {
        INT UNSIGNED user_id PK "AUTO_INCREMENT"
        VARCHAR(150) email UK "NOT NULL"
        VARCHAR(255) password_hash "NOT NULL"
        VARCHAR(150) full_name "NOT NULL"
        VARCHAR(20) phone "NULL"
        ENUM role "ADMIN | DRILLER"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    customers {
        INT UNSIGNED customer_id PK "AUTO_INCREMENT"
        INT UNSIGNED user_id FK "NULL = มาจาก LINE"
        VARCHAR(100) line_user_id UK "NULL"
        VARCHAR(150) customer_name "NOT NULL"
        VARCHAR(20) phone "NOT NULL"
        VARCHAR(20) phone_alt "NULL"
        TEXT address "NULL"
        VARCHAR(150) line_display_name "NULL"
        VARCHAR(500) line_picture_url "NULL"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    wells {
        INT UNSIGNED well_id PK "AUTO_INCREMENT"
        INT UNSIGNED customer_id FK "NOT NULL"
        VARCHAR(150) well_name "DEFAULT 'บ่อหลัก'"
        TEXT address "NULL"
        DECIMAL(7,2) requested_depth_m "NULL"
        DECIMAL(7,2) total_depth_m "NULL"
        ENUM drilling_method "ROTARY|DTH|CABLE_TOOL|AUGER|JETTING|OTHER"
        ENUM formation_water_type "FRESH|BRACKISH|SALINE|UNKNOWN"
        DECIMAL(8,2) water_quantity_m3hr "NULL"
        DECIMAL(8,2) yield_lpm "NULL"
        DECIMAL(7,2) static_water_level_m "NULL"
        DECIMAL(7,2) pumping_water_level_m "NULL"
        VARCHAR(120) driller_name "NULL"
        DATE completion_date "NULL"
        DATE warranty_expire_date "GENERATED"
        ENUM result "SUCCESS | FAIL"
        TEXT failure_reason "NULL"
        TEXT notes "NULL"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    well_strata_logs {
        INT UNSIGNED strata_id PK "AUTO_INCREMENT"
        INT UNSIGNED well_id FK "NOT NULL"
        DECIMAL(7,2) depth_from_m "NOT NULL"
        DECIMAL(7,2) depth_to_m "NOT NULL"
        ENUM lithology_type "TOP_SOIL|CLAY|SAND|GRAVEL|LATERITE|SANDSTONE|SHALE|LIMESTONE|GRANITE|BASALT|HARDROCK|OTHER"
        VARCHAR(120) lithology_name "NULL"
        CHAR(7) color_hex "NULL"
        ENUM hardness "VERY_SOFT|SOFT|MEDIUM|HARD|VERY_HARD"
        TINYINT(1) water_bearing "DEFAULT 0"
        VARCHAR(255) description "NULL"
    }

    well_pipes {
        INT UNSIGNED pipe_id PK "AUTO_INCREMENT"
        INT UNSIGNED well_id FK "NOT NULL"
        ENUM material "PVC|STEEL|STAINLESS_STEEL|HDPE|OTHER"
        ENUM pipe_type "CASING | SCREEN"
        DECIMAL(6,1) size_mm "NULL"
        DECIMAL(7,2) depth_from_m "NOT NULL"
        DECIMAL(7,2) depth_to_m "NOT NULL"
        INT UNSIGNED quantity "DEFAULT 1"
        TEXT notes "NULL"
    }

    well_pumps {
        INT UNSIGNED pump_id PK "AUTO_INCREMENT"
        INT UNSIGNED well_id FK "NOT NULL"
        ENUM pump_type "AC_SUBMERSIBLE|DC_SOLAR_SUBMERSIBLE|OTHER"
        VARCHAR(100) brand "NULL"
        VARCHAR(100) pump_model "NULL"
        DECIMAL(5,2) horsepower "NULL"
        DECIMAL(5,2) power_kw "NULL"
        INT impeller_stages "NULL"
        DECIMAL(7,2) installation_depth_m "NULL"
        VARCHAR(20) voltage "NULL"
        INT phase "NULL"
        DECIMAL(6,1) discharge_size_mm "NULL"
        DECIMAL(8,2) rated_flow_m3hr "NULL"
        DECIMAL(7,2) rated_head_m "NULL"
        DATE installed_date "NULL"
        TEXT notes "NULL"
    }

    well_control_boxes {
        INT UNSIGNED control_box_id PK "AUTO_INCREMENT"
        INT UNSIGNED well_id FK "NOT NULL"
        VARCHAR(100) brand "NULL"
        VARCHAR(100) model "NULL"
        VARCHAR(50) capacity "NULL"
        VARCHAR(50) voltage "NULL"
        ENUM protection_type "OVERLOAD_RELAY|CIRCUIT_BREAKER|AUTO_RESTART|WATER_LEVEL|LIGHTNING|NONE|OTHER"
        VARCHAR(255) features "NULL"
        DATE installed_date "NULL"
        TEXT notes "NULL"
    }

    pump_catalog_models {
        INT UNSIGNED model_id PK "AUTO_INCREMENT"
        VARCHAR(50) brand "NOT NULL  FRANKLIN|TORQUE|..."
        VARCHAR(120) series "NULL"
        VARCHAR(150) model "NOT NULL"
        VARCHAR(20) bore_size "NULL  ขนาดบ่อ(นิ้ว)"
        VARCHAR(80) flow_rate "NULL"
        VARCHAR(80) motor_power "NULL  HP/kW"
        VARCHAR(30) phase "NULL  เฟส/แรงดัน"
        VARCHAR(50) discharge_size "NULL"
        VARCHAR(50) impeller_stages "NULL"
        VARCHAR(50) max_head_m "NULL"
        VARCHAR(120) material "NULL"
        VARCHAR(500) features "NULL"
        DECIMAL(12,2) reference_price "NULL  ราคาอ้างอิง(บาท)"
        TEXT notes "NULL"
        INT sort_order "DEFAULT 0"
        TINYINT(1) is_active "DEFAULT 1"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    drilling_requests {
        INT UNSIGNED request_id PK "AUTO_INCREMENT"
        INT UNSIGNED customer_id FK "NOT NULL"
        ENUM source "GOOGLE_FORM|MANUAL|LINE"
        VARCHAR(150) name "NOT NULL"
        VARCHAR(20) phone "NOT NULL"
        TEXT address "NOT NULL"
        DECIMAL(7,2) requested_depth_m "NULL"
        ENUM status "NEW|QUOTED|ACCEPTED|REJECTED|CANCELLED"
        TEXT notes "NULL"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    drilling_jobs {
        INT UNSIGNED job_id PK "AUTO_INCREMENT"
        INT UNSIGNED request_id FK "SET NULL"
        INT UNSIGNED customer_id FK "NOT NULL"
        INT UNSIGNED well_id FK "SET NULL"
        ENUM status "QUEUED|DRILLING|SUCCESS|FAILED|CLOSED"
        ENUM result "SUCCESS | FAILED"
        TEXT failure_reason "NULL"
        VARCHAR(200) job_title "NULL"
        TEXT site_address "NULL"
        VARCHAR(80) province "NULL"
        VARCHAR(80) district "NULL"
        DATE scheduled_date "NULL = Queue Pool"
        VARCHAR(100) magic_link_token UK "NULL"
        DATETIME magic_link_expires_at "NULL"
        TEXT notes "NULL"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    repair_requests {
        INT UNSIGNED repair_id PK "AUTO_INCREMENT"
        INT UNSIGNED customer_id FK "NOT NULL"
        INT UNSIGNED well_id FK "SET NULL"
        JSON problems "NOT NULL"
        TEXT detail "NULL"
        JSON photos "NULL"
        DATE scheduled_date "NULL"
        ENUM status "NEW|QUOTED|ACCEPTED|REJECTED|SCHEDULED|IN_PROGRESS|COMPLETED|CANCELLED"
        VARCHAR(100) magic_link_token UK "NULL"
        DATETIME magic_link_expires_at "NULL"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    quotations {
        INT UNSIGNED quotation_id PK "AUTO_INCREMENT"
        ENUM kind "DRILLING | REPAIR"
        INT UNSIGNED drilling_request_id FK "NULL"
        INT UNSIGNED repair_request_id FK "NULL"
        DECIMAL(12,2) price "NOT NULL"
        ENUM status "PENDING|ACCEPTED|REJECTED"
        TEXT notes "NULL"
        TIMESTAMP created_at
        TIMESTAMP updated_at
    }

    repair_records {
        INT UNSIGNED record_id PK "AUTO_INCREMENT"
        INT UNSIGNED repair_id FK "NOT NULL"
        DECIMAL(12,2) final_price "NULL"
        TEXT work_details "NULL"
        JSON parts "NULL"
        JSON pump "NULL  ปั๊มที่ติดตั้งระหว่างซ่อม"
        VARCHAR(500) payment_slip_url "NULL"
        TINYINT(1) is_warranty_claim "DEFAULT 0"
        DATETIME completed_at "NULL"
        TIMESTAMP created_at
    }

    line_notifications {
        INT UNSIGNED notification_id PK "AUTO_INCREMENT"
        INT UNSIGNED customer_id FK "NOT NULL"
        ENUM kind "QUOTE|STATUS|REMINDER|OTHER"
        TEXT content "NULL"
        VARCHAR(100) line_message_id "NULL"
        ENUM status "SENT|FAILED"
        TIMESTAMP sent_at
    }

    users ||--o{ customers : "ผู้ประกอบการเป็นเจ้าของ"
    customers ||--o{ wells : "มีบ่อ"
    wells ||--o{ well_strata_logs : "ชั้นดิน"
    wells ||--o{ well_pipes : "ท่อ"
    wells ||--o{ well_pumps : "ปั๊ม"
    wells ||--o{ well_control_boxes : "กล่องคอนโทรล"
    customers ||--o{ drilling_requests : "แจ้งเจาะ"    drilling_requests ||--o{ drilling_jobs : "สร้างคิว"
    drilling_jobs ||--o{ wells : "ลิงก์บ่อเมื่อสำเร็จ"
    customers ||--o{ repair_requests : "แจ้งซ่อม"
    repair_requests ||--o{ repair_records : "บันทึกหลังซ่อม"
    drilling_requests ||--o{ quotations : "kind=DRILLING"
    repair_requests ||--o{ quotations : "kind=REPAIR"
    customers ||--o{ line_notifications : "log ส่ง LINE"
```

---

## Relationship Summary

```
users (1) ──── (M) customers             FK: customers.user_id → users.user_id (NULL = มาจาก LINE)
customers (1) ──── (M) wells             FK: wells.customer_id → customers.customer_id
wells (1) ──── (M) well_strata_logs      FK: well_strata_logs.well_id → wells.well_id
wells (1) ──── (M) well_pipes            FK: well_pipes.well_id → wells.well_id
wells (1) ──── (M) well_pumps            FK: well_pumps.well_id → wells.well_id
wells (1) ──── (M) well_control_boxes    FK: well_control_boxes.well_id → wells.well_id
customers (1) ──── (M) drilling_requests  FK: drilling_requests.customer_id → customers.customer_id
drilling_requests (1) ──── (M) drilling_jobs  FK: drilling_jobs.request_id → drilling_requests.request_id
drilling_jobs (1) ──── (0..1) wells        FK: drilling_jobs.well_id → wells.well_id (ลิงก์เมื่อเจาะสำเร็จ)
customers (1) ──── (M) repair_requests   FK: repair_requests.customer_id → customers.customer_id
repair_requests (1) ──── (M) repair_records  FK: repair_records.repair_id → repair_requests.repair_id
drilling_requests (1) ──── (M) quotations FK: quotations.drilling_request_id → drilling_requests.request_id
repair_requests (1) ──── (M) quotations   FK: quotations.repair_request_id → repair_requests.repair_id
customers (1) ──── (M) line_notifications FK: line_notifications.customer_id → customers.customer_id
```

หมายเหตุ: ช่างไม่มีตารางแยก — เข้าผ่าน magic link ตาม `drilling_jobs.magic_link_token` / `repair_requests.magic_link_token` ชื่อช่างบันทึกเป็นข้อความอิสระ (`wells.driller_name`, `repair_records.work_details`)

---

## Table: `users` — ผู้ประกอบการ (login)

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `user_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสผู้ประกอบการ |
| `email` | `VARCHAR(150)` | NOT NULL, UNIQUE | อีเมล/username ใช้เข้าสู่ระบบ |
| `password_hash` | `VARCHAR(255)` | NOT NULL | hash รหัสผ่าน (bcrypt) |
| `full_name` | `VARCHAR(150)` | NOT NULL | ชื่อ-นามสกุล |
| `phone` | `VARCHAR(20)` | NULL | เบอร์โทร |
| `role` | `ENUM('ADMIN','DRILLER')` | NOT NULL, DEFAULT 'DRILLER' | สิทธิ์การใช้งาน |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | ON UPDATE CURRENT_TIMESTAMP | |

---

## Table: `customers` — ลูกค้า

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `customer_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสลูกค้า |
| `user_id` | `INT UNSIGNED` | FK → users, NULL | ผู้ประกอบการที่กรอกเอง (NULL = มาจาก LINE) |
| `line_user_id` | `VARCHAR(100)` | UNIQUE, NULL | LINE User ID ผูกตัวตนลูกค้า |
| `customer_name` | `VARCHAR(150)` | NOT NULL | ชื่อลูกค้า |
| `phone` | `VARCHAR(20)` | NOT NULL | เบอร์โทรหลัก |
| `phone_alt` | `VARCHAR(20)` | NULL | เบอร์สำรอง |
| `address` | `TEXT` | NULL | ที่อยู่ |
| `line_display_name` | `VARCHAR(150)` | NULL | ชื่อที่แสดงใน LINE |
| `line_picture_url` | `VARCHAR(500)` | NULL | URL รูปโปรไฟล์ LINE |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | ON UPDATE CURRENT_TIMESTAMP | |

---

## Table: `wells` — บ่อบาดาล

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `well_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสบ่อ |
| `customer_id` | `INT UNSIGNED` | NOT NULL, FK → customers | เจ้าของบ่อ (RESTRICT) |
| `well_name` | `VARCHAR(150)` | DEFAULT 'บ่อหลัก' | ชื่อบ่อ |
| `address` | `TEXT` | NULL | ที่ตั้งบ่อ |
| `requested_depth_m` | `DECIMAL(7,2)` | NULL | ความลึกที่ลูกค้าต้องการ |
| `total_depth_m` | `DECIMAL(7,2)` | NULL | ความลึกจริงที่เจาะได้ |
| `drilling_method` | `ENUM('ROTARY','DTH','CABLE_TOOL','AUGER','JETTING','OTHER')` | NULL | วิธีเจาะ |
| `formation_water_type` | `ENUM('FRESH','BRACKISH','SALINE','UNKNOWN')` | DEFAULT 'UNKNOWN' | ประเภทน้ำ |
| `water_quantity_m3hr` | `DECIMAL(8,2)` | NULL | อัตราน้ำ (ลบ.ม./ชม.) |
| `yield_lpm` | `DECIMAL(8,2)` | NULL | อัตราผลผลิต (ลิตร/นาที) |
| `static_water_level_m` | `DECIMAL(7,2)` | NULL | ระดับน้ำนิ่ง |
| `pumping_water_level_m` | `DECIMAL(7,2)` | NULL | ระดับน้ำขณะสูบ |
| `driller_name` | `VARCHAR(120)` | NULL | ชื่อช่างผู้เจาะ |
| `completion_date` | `DATE` | NULL | วันที่เจาะเสร็จ |
| `warranty_expire_date` | `DATE` | GENERATED STORED | `DATE_ADD(completion_date, INTERVAL 2 YEAR)` — ตั้งค่าเองไม่ได้ |
| `result` | `ENUM('SUCCESS','FAIL')` | DEFAULT 'SUCCESS' | ผลเจาะ |
| `failure_reason` | `TEXT` | NULL | เหตุผลที่ไม่สำเร็จ |
| `notes` | `TEXT` | NULL | หมายเหตุ |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | ON UPDATE CURRENT_TIMESTAMP | |

**Indexes:** `idx_well_customer (customer_id)`, `idx_well_completion (completion_date)`

---

## Table: `well_strata_logs` — Geological Log (ชั้นดิน/หิน)

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `strata_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสชั้น |
| `well_id` | `INT UNSIGNED` | NOT NULL, FK → wells | บ่อ (CASCADE) |
| `depth_from_m` | `DECIMAL(7,2)` | NOT NULL | ช่วงความลึกเริ่ม |
| `depth_to_m` | `DECIMAL(7,2)` | NOT NULL, CHECK (depth_to_m > depth_from_m) | ช่วงความลึกสิ้นสุด |
| `lithology_type` | `ENUM('TOP_SOIL','CLAY','SAND','GRAVEL','LATERITE','SANDSTONE','SHALE','LIMESTONE','GRANITE','BASALT','HARDROCK','OTHER')` | NULL | ประเภทดิน/หิน (dropdown) |
| `lithology_name` | `VARCHAR(120)` | NULL | ชื่อชั้นดิน/หิน |
| `color_hex` | `CHAR(7)` | NULL | สี (วาดรูปบ่อ) |
| `hardness` | `ENUM('VERY_SOFT','SOFT','MEDIUM','HARD','VERY_HARD')` | NULL | ความแข็ง |
| `water_bearing` | `TINYINT(1)` | DEFAULT 0 | ชั้นให้น้ำ |
| `description` | `VARCHAR(255)` | NULL | รายละเอียด |

**Indexes:** `idx_strata_well_depth (well_id, depth_from_m)`

---

## Table: `well_pipes` — ท่อ

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `pipe_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสท่อ |
| `well_id` | `INT UNSIGNED` | NOT NULL, FK → wells | บ่อ (CASCADE) |
| `material` | `ENUM('PVC','STEEL','STAINLESS_STEEL','HDPE','OTHER')` | NULL | วัสดุ |
| `pipe_type` | `ENUM('CASING','SCREEN')` | NULL | ทึบ / เซาะร่อง |
| `size_mm` | `DECIMAL(6,1)` | NULL | เส้นผ่านศูนย์กลาง (มม.) |
| `depth_from_m` | `DECIMAL(7,2)` | NOT NULL | ช่วงความลึกเริ่ม |
| `depth_to_m` | `DECIMAL(7,2)` | NOT NULL, CHECK (depth_to_m > depth_from_m) | ช่วงความลึกสิ้นสุด |
| `quantity` | `INT UNSIGNED` | DEFAULT 1 | จำนวนท่อน |
| `notes` | `TEXT` | NULL | หมายเหตุ |

**Indexes:** `idx_pipe_well_depth (well_id, depth_from_m)`

---

## Table: `well_pumps` — ปั๊ม

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `pump_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสปั๊ม |
| `well_id` | `INT UNSIGNED` | NOT NULL, FK → wells | บ่อ (CASCADE) |
| `pump_type` | `ENUM('AC_SUBMERSIBLE','DC_SOLAR_SUBMERSIBLE','OTHER')` | NULL | ชนิดปั๊ม |
| `brand` | `VARCHAR(100)` | NULL | ยี่ห้อ (dropdown: Franklin/TORQUE/Grundfos...) |
| `pump_model` | `VARCHAR(100)` | NULL | รุ่น |
| `horsepower` | `DECIMAL(5,2)` | NULL | แรงม้า |
| `power_kw` | `DECIMAL(5,2)` | NULL | กิโลวัตต์ |
| `impeller_stages` | `INT` | NULL | จำนวนใบพัด |
| `installation_depth_m` | `DECIMAL(7,2)` | NULL | ตำแหน่งที่หย่อน/แขวนปั๊ม |
| `voltage` | `VARCHAR(20)` | NULL | แรงดันไฟ (V) |
| `phase` | `INT` | NULL | เฟส 1/3 |
| `discharge_size_mm` | `DECIMAL(6,1)` | NULL | ขนาดท่อจ่าย (มม.) |
| `rated_flow_m3hr` | `DECIMAL(8,2)` | NULL | อัตราการไหลที่กำหนด (ม³/ชม.) |
| `rated_head_m` | `DECIMAL(7,2)` | NULL | เฮดที่กำหนด (ม.) |
| `installed_date` | `DATE` | NULL | วันที่ติดตั้ง |
| `notes` | `TEXT` | NULL | หมายเหตุ |

**Indexes:** `idx_pump_well (well_id)`

---

## Table: `well_control_boxes` — กล่องคอนโทรล

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `control_box_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัส |
| `well_id` | `INT UNSIGNED` | NOT NULL, FK → wells | บ่อ (CASCADE) |
| `brand` | `VARCHAR(100)` | NULL | ยี่ห้อ |
| `model` | `VARCHAR(100)` | NULL | รุ่น |
| `capacity` | `VARCHAR(50)` | NULL | ขนาด/กำลัง |
| `voltage` | `VARCHAR(50)` | NULL | แรงดันไฟ |
| `protection_type` | `ENUM('OVERLOAD_RELAY','CIRCUIT_BREAKER','AUTO_RESTART','WATER_LEVEL','LIGHTNING','NONE','OTHER')` | NULL | ระบบป้องกันตู้คุมไฟ |
| `features` | `VARCHAR(255)` | NULL | อุปกรณ์ในตู้ (คอนแทคเตอร์/รีเลย์/ฯลฯ) |
| `installed_date` | `DATE` | NULL | วันที่ติดตั้ง |
| `notes` | `TEXT` | NULL | หมายเหตุ |

**Indexes:** `idx_control_box_well (well_id)`

---

## Table: `drilling_requests` — คำร้องแจ้งเจาะ

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `request_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสคำร้อง |
| `customer_id` | `INT UNSIGNED` | NOT NULL, FK → customers | ลูกค้าผู้ร้อง (CASCADE) |
| `source` | `ENUM('GOOGLE_FORM','MANUAL','LINE')` | DEFAULT 'GOOGLE_FORM' | ต้นทางคำร้อง |
| `name` | `VARCHAR(150)` | NOT NULL | ชื่อผู้แจ้ง (Google Form) |
| `phone` | `VARCHAR(20)` | NOT NULL | เบอร์โทร (Google Form) |
| `address` | `TEXT` | NOT NULL | ที่อยู่ (Google Form) |
| `requested_depth_m` | `DECIMAL(7,2)` | NULL | ความลึกที่ต้องการ |
| `status` | `ENUM('NEW','QUOTED','ACCEPTED','REJECTED','CANCELLED')` | DEFAULT 'NEW' | สถานะ Flow A |
| `notes` | `TEXT` | NULL | หมายเหตุ |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | ON UPDATE CURRENT_TIMESTAMP | |

**Indexes:** `idx_drill_req_customer (customer_id)`, `idx_drill_req_status (status)`

---

## Table: `drilling_jobs` — คิวงานเจาะ (Queue Pool)

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `job_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสคิว |
| `request_id` | `INT UNSIGNED` | FK → drilling_requests, NULL (SET NULL) | คำร้องต้นทาง (NULL = กรอกเอง) |
| `customer_id` | `INT UNSIGNED` | NOT NULL, FK → customers | ลูกค้า (RESTRICT) |
| `well_id` | `INT UNSIGNED` | FK → wells, NULL (SET NULL) | บ่อ (ตั้งเมื่อเจาะสำเร็จ) |
| `status` | `ENUM('QUEUED','DRILLING','SUCCESS','FAILED','CLOSED')` | DEFAULT 'QUEUED' | สถานะคิว |
| `result` | `ENUM('SUCCESS','FAILED')` | NULL | ผลเจาะ |
| `failure_reason` | `TEXT` | NULL | เหตุผลไม่สำเร็จ |
| `job_title` | `VARCHAR(200)` | NULL | ชื่องาน |
| `site_address` | `TEXT` | NULL | ที่อยู่หน้างาน |
| `province` | `VARCHAR(80)` | NULL | จังหวัด |
| `district` | `VARCHAR(80)` | NULL | อำเภอ |
| `scheduled_date` | `DATE` | NULL | วันที่นัด (NULL = คิวไม่มีวันตายตัว) |
| `magic_link_token` | `VARCHAR(100)` | UNIQUE, NULL | ลิงก์ช่าง (ไม่ต้อง login) |
| `magic_link_expires_at` | `DATETIME` | NULL | หมดอายุลิงก์ |
| `notes` | `TEXT` | NULL | หมายเหตุ |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | ON UPDATE CURRENT_TIMESTAMP | |

**Indexes:** `idx_job_customer (customer_id)`, `idx_job_status (status)`

---

## Table: `repair_requests` — รายการแจ้งซ่อม

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `repair_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสคำร้องซ่อม |
| `customer_id` | `INT UNSIGNED` | NOT NULL, FK → customers | ลูกค้า (CASCADE) |
| `well_id` | `INT UNSIGNED` | FK → wells, NULL (SET NULL) | บ่อที่เลือก |
| `problems` | `JSON` | NOT NULL | ปัญหาที่ติ๊ก `["ปั๊มไม่ทำงาน",...]` |
| `detail` | `TEXT` | NULL | รายละเอียดเพิ่มเติม |
| `photos` | `JSON` | NULL | URL รูปที่แนบ (array) |
| `scheduled_date` | `DATE` | NULL | วันนัดซ่อม |
| `status` | `ENUM('NEW','QUOTED','ACCEPTED','REJECTED','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')` | DEFAULT 'NEW' | สถานะ Flow B |
| `magic_link_token` | `VARCHAR(100)` | UNIQUE, NULL | ลิงก์ช่าง |
| `magic_link_expires_at` | `DATETIME` | NULL | หมดอายุลิงก์ |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | ON UPDATE CURRENT_TIMESTAMP | |

**Indexes:** `idx_repair_customer (customer_id)`, `idx_repair_status (status)`

---

## Table: `quotations` — ราคาประเมิน (เจาะ + ซ่อม)

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `quotation_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสใบราคา |
| `kind` | `ENUM('DRILLING','REPAIR')` | NOT NULL | ของเจาะหรือซ่อม |
| `drilling_request_id` | `INT UNSIGNED` | FK → drilling_requests, NULL (RESTRICT) | โยงคำร้องเจาะ (เมื่อ kind=DRILLING) |
| `repair_request_id` | `INT UNSIGNED` | FK → repair_requests, NULL (RESTRICT) | โยงคำร้องซ่อม (เมื่อ kind=REPAIR) |
| `price` | `DECIMAL(12,2)` | NOT NULL | ราคาที่ประเมิน |
| `status` | `ENUM('PENDING','ACCEPTED','REJECTED')` | DEFAULT 'PENDING' | ยอมรับ/ปฏิเสธของลูกค้า |
| `notes` | `TEXT` | NULL | รายละเอียดราคา |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |
| `updated_at` | `TIMESTAMP` | ON UPDATE CURRENT_TIMESTAMP | |

**CHECK constraint:** `drilling_request_id` / `repair_request_id` ได้แค่ตัวเดียวที่ตรงกับ `kind`

---

## Table: `repair_records` — บันทึกหลังซ่อมเสร็จ

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `record_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสบันทึก |
| `repair_id` | `INT UNSIGNED` | NOT NULL, FK → repair_requests | คำร้องซ่อมที่ทำเสร็จ (CASCADE) |
| `final_price` | `DECIMAL(12,2)` | NULL | ราคาจบงานจริง |
| `work_details` | `TEXT` | NULL | รายละเอียดอะไหล่/งานที่ทำ |
| `parts` | `JSON` | NULL | รายการอะไหล่ `[{"name","qty","unit_price"}]` |
| `pump` | `JSON` | NULL | ปั๊มที่ติดตั้ง/เปลี่ยนระหว่างซ่อม (จากการเลือกแคตตาล็อก) |
| `payment_slip_url` | `VARCHAR(500)` | NULL | สลิปจ่ายเงิน (URL) |
| `is_warranty_claim` | `TINYINT(1)` | DEFAULT 0 | ใช้สิทธิ์ประกัน |
| `completed_at` | `DATETIME` | NULL | เวลาซ่อมเสร็จ |
| `created_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | |

**Indexes:** `idx_record_repair (repair_id)`

---

## Table: `pump_catalog_models` — แคตตาล็อกปั๊มซับเมอร์ส (Master)

ข้อมูลปั๊ม Franklin Electric + TORQUE ที่ import จากแคตตาล็อก — ใช้เป็น dropdown "ยี่ห้อ → รุ่น" บนหน้า บันทึกบ่อหลังเจาะ และ บันทึกการซ่อม
เมื่อเลือกยี่ห้อ → รุ่น แล้ว ข้อมูลสเปกจะถูกกรอกให้อัตโนมัติ (ค่าที่เป็นช่วง/เชิงพรรณนาเก็บเป็น VARCHAR เพื่อความเที่ยงตรง)

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `model_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัสรุ่น |
| `brand` | `VARCHAR(50)` | NOT NULL | ยี่ห้อ (`FRANKLIN` / `TORQUE` / ...) |
| `series` | `VARCHAR(120)` | NULL | ชื่อซีรีส์ เช่น `4" Tri Seal` |
| `model` | `VARCHAR(150)` | NOT NULL | รุ่น/รหัสรุ่น |
| `bore_size` | `VARCHAR(20)` | NULL | ขนาดบ่อ (นิ้ว) |
| `flow_rate` | `VARCHAR(80)` | NULL | อัตราการไหล (LPM/gpm/m³/h) |
| `motor_power` | `VARCHAR(80)` | NULL | กำลังมอเตอร์ (HP / kW) |
| `phase` | `VARCHAR(30)` | NULL | เฟส / แรงดัน |
| `discharge_size` | `VARCHAR(50)` | NULL | ขนาดท่อจ่าย |
| `impeller_stages` | `VARCHAR(50)` | NULL | จำนวนใบพัด / สเตจ |
| `max_head_m` | `VARCHAR(50)` | NULL | เฮดส่งสูงสุด (ม.) |
| `material` | `VARCHAR(120)` | NULL | วัสดุ |
| `features` | `VARCHAR(500)` | NULL | จุดเด่น |
| `reference_price` | `DECIMAL(12,2)` | NULL | ราคาอ้างอิง (บาท) |
| `notes` | `TEXT` | NULL | หมายเหตุ |
| `sort_order` | `INT` | DEFAULT 0 | ลำดับเรียง |
| `is_active` | `TINYINT(1)` | DEFAULT 1 | ใช้งาน/ซ่อน |
| `created_at` / `updated_at` | `TIMESTAMP` | | |

**Indexes:** `idx_pump_catalog_brand (brand, is_active, sort_order)`

---

## Table: `line_notifications` — log ส่งข้อความ LINE

| คอลัมน์ | ชนิด | Constraint | ความหมาย |
|---|---|---|---|
| `notification_id` | `INT UNSIGNED` | PK, AUTO_INCREMENT | รหัส |
| `customer_id` | `INT UNSIGNED` | NOT NULL, FK → customers | ลูกค้าที่ส่งให้ (CASCADE) |
| `kind` | `ENUM('QUOTE','STATUS','REMINDER','OTHER')` | NULL | ประเภทข้อความ |
| `content` | `TEXT` | NULL | ข้อความที่ส่ง |
| `line_message_id` | `VARCHAR(100)` | NULL | ID จาก LINE API |
| `status` | `ENUM('SENT','FAILED')` | DEFAULT 'SENT' | ส่งสำเร็จ/ไม่สำเร็จ |
| `sent_at` | `TIMESTAMP` | DEFAULT CURRENT_TIMESTAMP | เวลาส่ง |

**Indexes:** `idx_notif_customer (customer_id)`

---

## View: `well_warranty_view` — สถานะประกัน (อ่านอย่างเดียว)

คำนวณจาก `wells` JOIN `customers`:
- `days_left` = `DATEDIFF(warranty_expire_date, CURDATE())`
- `warranty_status` = `UNKNOWN` (ยังไม่มีวันเสร็จ) / `ACTIVE` (ในประกัน) / `EXPIRED` (หมด)

ใช้สำหรับ Flow C — เมื่อลูกค้าถามใน LINE bot เรื่องสถานะ-วันหมดอายุประกัน

---

## Foreign Key Summary

| FK Name | Child Table.Column | Parent Table.Column | ON DELETE | ON UPDATE |
|---------|-------------------|---------------------|-----------|-----------|
| `fk_customers_user` | `customers.user_id` | `users.user_id` | SET NULL | CASCADE |
| `fk_wells_customer` | `wells.customer_id` | `customers.customer_id` | RESTRICT | CASCADE |
| `fk_strata_well` | `well_strata_logs.well_id` | `wells.well_id` | CASCADE | CASCADE |
| `fk_pipe_well` | `well_pipes.well_id` | `wells.well_id` | CASCADE | CASCADE |
| `fk_pump_well` | `well_pumps.well_id` | `wells.well_id` | CASCADE | CASCADE |
| `fk_control_box_well` | `well_control_boxes.well_id` | `wells.well_id` | CASCADE | CASCADE |
| `fk_drill_req_customer` | `drilling_requests.customer_id` | `customers.customer_id` | CASCADE | CASCADE |
| `fk_jobs_request` | `drilling_jobs.request_id` | `drilling_requests.request_id` | SET NULL | CASCADE |
| `fk_jobs_customer` | `drilling_jobs.customer_id` | `customers.customer_id` | RESTRICT | CASCADE |
| `fk_jobs_well` | `drilling_jobs.well_id` | `wells.well_id` | SET NULL | CASCADE |
| `fk_repair_customer` | `repair_requests.customer_id` | `customers.customer_id` | CASCADE | CASCADE |
| `fk_repair_well` | `repair_requests.well_id` | `wells.well_id` | SET NULL | CASCADE |
| `fk_record_repair` | `repair_records.repair_id` | `repair_requests.repair_id` | CASCADE | CASCADE |
| `fk_quotation_drill` | `quotations.drilling_request_id` | `drilling_requests.request_id` | RESTRICT | CASCADE |
| `fk_quotation_repair` | `quotations.repair_request_id` | `repair_requests.repair_id` | RESTRICT | CASCADE |
| `fk_notif_customer` | `line_notifications.customer_id` | `customers.customer_id` | CASCADE | CASCADE |

---

## Index Summary

| Table | Index Name | Columns | Type |
|-------|-----------|---------|------|
| `customers` | `idx_customer_line` | `line_user_id` | Unique |
| `customers` | `idx_customer_user` | `user_id` | Non-unique |
| `wells` | `idx_well_customer` | `customer_id` | Non-unique |
| `wells` | `idx_well_completion` | `completion_date` | Non-unique |
| `well_strata_logs` | `idx_strata_well_depth` | `well_id, depth_from_m` | Composite |
| `well_pipes` | `idx_pipe_well_depth` | `well_id, depth_from_m` | Composite |
| `well_pumps` | `idx_pump_well` | `well_id` | Non-unique |
| `well_control_boxes` | `idx_control_box_well` | `well_id` | Non-unique |
| `drilling_requests` | `idx_drill_req_customer` | `customer_id` | Non-unique |
| `drilling_requests` | `idx_drill_req_status` | `status` | Non-unique |
| `drilling_jobs` | `idx_job_customer` | `customer_id` | Non-unique |
| `drilling_jobs` | `idx_job_status` | `status` | Non-unique |
| `drilling_jobs` | `idx_job_magic_link` | `magic_link_token` | Unique |
| `repair_requests` | `idx_repair_customer` | `customer_id` | Non-unique |
| `repair_requests` | `idx_repair_status` | `status` | Non-unique |
| `repair_requests` | `idx_repair_magic_link` | `magic_link_token` | Unique |
| `repair_records` | `idx_record_repair` | `repair_id` | Non-unique |
| `line_notifications` | `idx_notif_customer` | `customer_id` | Non-unique |

---

## CHECK Constraints

| Table | Constraint | Expression |
|-------|-----------|------------|
| `well_strata_logs` | `chk_strata_depth` | `depth_to_m > depth_from_m` |
| `well_pipes` | `chk_pipe_depth` | `depth_to_m > depth_from_m` |
| `quotations` | `chk_quotation_kind` | `(kind = 'DRILLING' AND drilling_request_id IS NOT NULL AND repair_request_id IS NULL) OR (kind = 'REPAIR' AND repair_request_id IS NOT NULL AND drilling_request_id IS NULL)` |

---

## หมายเหตุสำคัญ

- **ไม่มี GPS ในระบบ** — ลบ `latitude`/`longitude`/`gps_accuracy_m` ออกทั้งหมด
- `warranty_expire_date` เป็น GENERATED column — ตั้งค่าเองไม่ได้ ระบบคำนวณ = `completion_date + 2 ปี`
- `quotations` บังคับ 1 ใบราคา ต่อ 1 คำร้อง (ผ่าน CHECK constraint)
- `scheduled_date` ใน `drilling_jobs` เป็น NULL ได้ตามสเปก "Queue Pool แบบไม่มีวันที่ตายตัว"
- ช่างเข้าถึงงานผ่าน magic link เท่านั้น — ควรบังคับวันหมดอายุ (`magic_link_expires_at`)
- ข้อมูลลูกค้าที่มาจาก LINE มี `line_user_id` เป็นตัวผูกตัวตน (unique) — ใช้ดึงข้อมูลตอบบอทได้
