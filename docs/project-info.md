# ระบบจัดการบ่อบาดาลดิจิทัล — บันทึกข้อมูลโปรเจค (อัปเดตล่าสุด)

> บันทึกสรุประบบปัจจุบัน ข้อมูลอัปเดตล่าสุด + Flow การทำงาน + โครงสร้างฐานข้อมูลละเอียด
> ฐานข้อมูล: MySQL 8.0 | DB: `well_drilling` | charset: `utf8mb4`

---

## 1. ภาพรวม

ระบบบริหารจัดการบ่อบาดาลดิจิทัล — Web App (สำหรับผู้ประกอบการ + ช่าง) + LINE OA (สำหรับลูกค้า)

**จุดเปลี่ยนหลักจากเวอร์ชันเก่า:** ลูกค้าเป็นผู้เริ่มคำร้อง (แจ้งเจาะ / แจ้งซ่อม) เองผ่าน LINE ได้ทั้งหมด
แทนที่จะให้ผู้ประกอบการคีย์ข้อมูลอย่างเดียว

### 1.1 บทบาทผู้ใช้ (3 กลุ่ม)

| บทบาท | เข้าระบบยังไง |
|---|---|
| ผู้ประกอบการ | Login username/password เต็มรูปแบบ (`users` ตาราง) |
| ลูกค้า | Login ผ่าน LINE (LIFF) — เก็บ User ID + ชื่อ + รูปโปรไฟล์ |
| ช่าง | ไม่มี login — เข้าผ่าน magic link ต่อ job ที่ผู้ประกอบการส่งให้ |

### 1.2 หน้าเว็บทั้งหมด (10 หน้า)

**ฝั่งผู้ประกอบการ (login) — 6 หน้า**
1. Dashboard / ภาพรวม
2. คิวงาน (Queue Pool แบบไม่มีวันที่ตายตัว)
3. [ใหม่] คำร้องแจ้งเจาะ — ดูคำขอเจาะที่ลูกค้าส่งเข้ามา
4. รายละเอียดบ่อ (Well Detail)
5. เพิ่มบ่อ/ลูกค้าใหม่ (กรอกเองกรณีไม่ผ่าน LINE)
6. [ใหม่] รายการแจ้งซ่อม — ดูคำขอซ่อมที่ลูกค้าส่งเข้ามา

**ฝั่งช่าง (magic link, ไม่ login) — 2 หน้า**
7. [ใหม่] กรอกข้อมูลบ่อหลังเจาะเสร็จ (dropdown เยอะ)
8. [ใหม่] บันทึกข้อมูลการซ่อมหลังซ่อมเสร็จ

**ฝั่งลูกค้า — 2 ช่องทาง**
9. Google Form แจ้งเจาะ (ภายนอก เชื่อมผ่าน LIFF + Webhook)
10. [ใหม่] ฟอร์มแจ้งซ่อม (เว็บของเราเอง)

**เมนู LINE OA (แชทบอท ไม่ใช่หน้าเว็บ)**

แจ้งเจาะ / แจ้งซ่อม / ดูข้อมูลบ่อบาดาล / ดูสถานะ-วันหมดอายุประกัน / ดูประวัติการซ่อม
(3 ปุ่มหลังตอบเป็นข้อความ list เลย ไม่มีหน้าเว็บแยก)

---

## 2. Flow การทำงานปัจจุบัน

### Flow A: แจ้งเจาะบ่อใหม่

```
Login LINE (LIFF)
   ↓
กรอก Google Form (ชื่อ/เบอร์/ที่อยู่/ความลึก)
   ↓  Webhook เข้า DB → ตาราง drilling_requests
หน้า "คำร้องแจ้งเจาะ" (ผู้ประกอบการ)
   ↓  ตีราคา → สร้างใบราคา quotations + ส่งกลับ LINE
ลูกค้า ยอมรับ / ปฏิเสธ (ตอบใน LINE)
   ├─ ปฏิเสธ → REJECTED
   └─ ยอมรับ → ACCEPTED → เข้าคิว "รอดำเนินการ" (drilling_jobs status=QUEUED)
                          ↓
                      "กำลังเจาะ" (status=DRILLING)
                          ↓  ช่างกรอกข้อมูลผ่าน magic link
              สำเร็จ (เขียว) → สร้างบ่อ wells + รายละเอียด (ท่อ/ปั๊ม/กล่องคอนโทรล/ชั้นดิน)
              ไม่สำเร็จ (แดง) + เหตุผล → wells.result=FAIL / failure_reason
                          ↓
                ผู้ประกอบการปิดคิวเอง (CLOSED)
```

สถานะที่ใช้: `drilling_requests.status` = NEW → QUOTED → ACCEPTED | REJECTED | CANCELLED
`drilling_jobs.status` = QUEUED → DRILLING → SUCCESS | FAILED → CLOSED

### Flow B: แจ้งซ่อม

```
กด "แจ้งซ่อม" ในเมนู LINE
   ↓
หน้าฟอร์มเว็บ (ของเรา):
  - ติ๊กปัญหา (problems = JSON array)
  - เลือกบ่อ (well_id)
  - แนบรูป (photos = JSON array)
  - เลือกวันนัดซ่อม (scheduled_date)
   ↓  เข้า "รายการแจ้งซ่อม" (repair_requests)
ผู้ประกอบการตีราคา → quotations + ส่งกลับ LINE
   ↓  ลูกค้า ยอมรับ / ปฏิเสธ
   ├─ ปฏิเสธ → REJECTED
   └─ ยอมรับ → ACCEPTED → SCHEDULED (รอช่างตามวันนัด)
                          ↓  ช่างเข้าผ่าน magic link
                       IN_PROGRESS
                          ↓  ช่างกรอกราคาจบงาน + รายละเอียด (repair_records)
                       COMPLETED → ปิดรายการ
```

สถานะที่ใช้: `repair_requests.status` = NEW → QUOTED → ACCEPTED → SCHEDULED → IN_PROGRESS → COMPLETED | REJECTED | CANCELLED

### Flow C: ดูข้อมูล (ผ่าน LINE OA bot โดยตรง)

```
ลูกค้าถามในแชท เช่น "ดูข้อมูลบ่อ" / "สถานะประกัน" / "ประวัติซ่อม"
   ↓  บอทดึงข้อมูลจาก DB ตาม line_user_id
ดูข้อมูลบ่อ → wells + well_strata_logs/well_pipes/well_pumps/well_control_boxes
ดูสถานะ-วันหมดอายุประกัน → well_warranty_view (ACTIVE/EXPIRED + days_left)
ดูประวัติการซ่อม → repair_requests JOIN repair_records
   ↓  ตอบเป็น list ข้อความ (ถ้ามีหลายบ่อ ลิสต์ทีละบ่อ)
```

---

## 3. ข้อมูลที่บันทึกในแต่ละจุด

| จุด | ข้อมูลที่เก็บ |
|---|---|
| Login LINE | User ID (`customers.line_user_id`), ชื่อ (`line_display_name`), รูปโปรไฟล์ (`line_picture_url`) |
| Google Form แจ้งเจาะ | ชื่อ, เบอร์โทร, ที่อยู่, ความลึกที่ต้องการ → `drilling_requests` |
| ราคาประเมิน (เจาะ/ซ่อม) | ราคา, สถานะยอมรับ/ปฏิเสธ → `quotations` |
| กรอกข้อมูลบ่อ (ช่าง) | Well Log, Geological Log, Pipe Specs (PVC/เหล็ก ทึบ/เซาะร่อง จำนวน+ช่วงความลึก), Pump Specs, Control Box Specs, ผลเจาะ, เหตุผลที่ไม่สำเร็จ (ใหม่) → `wells` + `well_strata_logs` + `well_pipes` + `well_pumps` + `well_control_boxes` |
| แคตตาล็อกปั๊ม | ยี่ห้อ → รุ่น (Franklin Electric + TORQUE) → ข้อมูลสเปกปั๊มขึ้นอัตโนมัติ → `pump_catalog_models` (Master) |
| ฟอร์มแจ้งซ่อม | ปัญหา(ติ๊ก), บ่อที่เลือก, รูปภาพ, วันนัดซ่อม → `repair_requests` |
| บันทึกซ่อม (ช่าง) | ราคาจบงาน, รายละเอียดอะไหล่/งานที่ทำ, ปั๊มที่เปลี่ยน (เลือกจากแคตตาล็อก), สลิปจ่ายเงิน → `repair_records` |

---

## 4. โครงสร้างฐานข้อมูล (ละเอียดทุกตารางทุกคอลัมน์)

### 4.1 แผนผังความสัมพันธ์

```
users 1───N customers 1───N wells 1───N well_strata_logs
                     │           ├───N well_pipes
                     │           ├───N well_pumps
                     │           └───N well_control_boxes
                     │
customers 1───N drilling_requests 1───N drilling_jobs ────(0..1) wells (ลิงก์เมื่อเจาะสำเร็จ)
customers 1───N repair_requests ────N repair_records
                    └───N wells (เลือกบ่อที่จะซ่อม)
drilling_requests 1───N quotations (kind=DRILLING)
repair_requests   1───N quotations (kind=REPAIR)
customers         1───N line_notifications
```

หมายเหตุ: ช่างไม่มีตารางแยก — เข้าผ่าน `magic_link_token` ชื่อช่างบันทึกเป็นข้อความอิสระ (`wells.driller_name`, `repair_records.work_details`)

---

### 4.2 users — ผู้ประกอบการ (login)

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| user_id | INT UNSIGNED (PK, auto) | รหัสผู้ประกอบการ | อัตโนมัติ |
| email | VARCHAR(150) UNIQUE | อีเมล/username ใช้เข้าสู่ระบบ | ผู้ประกอบการสมัคร |
| password_hash | VARCHAR(255) | hash รหัสผ่าน (bcrypt) | ตั้งตอนสมัคร |
| full_name | VARCHAR(150) | ชื่อ-นามสกุล | กรอกเอง |
| phone | VARCHAR(20) | เบอร์โทร | กรอกเอง |
| role | ENUM `ADMIN`/`DRILLER` (default `DRILLER`) | สิทธิ์การใช้งาน | ตั้งตอนสร้างบัญชี |
| created_at / updated_at | TIMESTAMP | เวลา | อัตโนมัติ |

### 4.3 customers — ลูกค้า

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| customer_id | INT UNSIGNED (PK) | รหัสลูกค้า | อัตโนมัติ |
| user_id | INT UNSIGNED (FK → users, NULL ได้) | ผู้ประกอบการที่กรอกเอง (NULL = มาจาก LINE) | ระบบโยง |
| line_user_id | VARCHAR(100) UNIQUE | LINE User ID ผูกตัวตนลูกค้า | LINE LIFF |
| customer_name | VARCHAR(150) NOT NULL | ชื่อลูกค้า | LINE / กรอกเอง |
| phone | VARCHAR(20) NOT NULL | เบอร์โทรหลัก | Google Form / กรอกเอง |
| phone_alt | VARCHAR(20) | เบอร์สำรอง | กรอกเอง |
| address | TEXT | ที่อยู่ | Google Form / กรอกเอง |
| line_display_name | VARCHAR(150) | ชื่อที่แสดงใน LINE | LINE profile |
| line_picture_url | VARCHAR(500) | URL รูปโปรไฟล์ LINE | LINE profile |
| created_at / updated_at | TIMESTAMP | เวลา | อัตโนมัติ |

### 4.4 wells — บ่อบาดาล

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| well_id | INT UNSIGNED (PK) | รหัสบ่อ | อัตโนมัติ |
| customer_id | INT UNSIGNED (FK → customers, RESTRICT) | เจ้าของบ่อ | ระบบโยง |
| well_name | VARCHAR(150) default `'บ่อหลัก'` | ชื่อบ่อ | ผู้ประกอบการ/ช่าง |
| address | TEXT | ที่ตั้งบ่อ | คำร้องเจาะ/กรอกเอง |
| requested_depth_m | DECIMAL(7,2) | ความลึกที่ลูกค้าต้องการ | คำร้องเจาะ |
| total_depth_m | DECIMAL(7,2) | ความลึกจริงที่เจาะได้ | ช่างกรอก |
| drilling_method | ENUM `ROTARY`/`DTH`/`CABLE_TOOL`/`AUGER`/`JETTING`/`OTHER` | วิธีเจาะ | ช่างกรอก |
| formation_water_type | ENUM `FRESH`/`BRACKISH`/`SALINE`/`UNKNOWN` (default `UNKNOWN`) | ประเภทน้ำ | ช่างกรอก |
| water_quantity_m3hr | DECIMAL(8,2) | อัตราน้ำ (ลบ.ม./ชม.) | ช่างกรอก |
| yield_lpm | DECIMAL(8,2) | อัตราผลผลิต (ลิตร/นาที) | ช่างกรอก |
| static_water_level_m | DECIMAL(7,2) | ระดับน้ำนิ่ง | ช่างกรอก |
| pumping_water_level_m | DECIMAL(7,2) | ระดับน้ำขณะสูบ | ช่างกรอก |
| driller_name | VARCHAR(120) | ชื่อช่างผู้เจาะ | ช่างกรอก |
| completion_date | DATE | วันที่เจาะเสร็จ | ช่างกรอก |
| warranty_expire_date | DATE GENERATED | `completion_date + 2 ปี` (ใส่เองไม่ได้) | **อัตโนมัติ** |
| result | ENUM `SUCCESS`/`FAIL` (default `SUCCESS`) | ผลเจาะ | ช่างกรอก |
| failure_reason | TEXT | เหตุผลที่ไม่สำเร็จ | ช่างกรอก |
| notes | TEXT | หมายเหตุ | ช่าง/ผู้ประกอบการ |
| created_at / updated_at | TIMESTAMP | เวลา | อัตโนมัติ |

### 4.5 well_strata_logs — Geological Log (ชั้นดิน/หิน)

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| strata_id | INT UNSIGNED (PK) | รหัสชั้น | อัตโนมัติ |
| well_id | INT UNSIGNED (FK → wells, CASCADE) | บ่อ | ระบบโยง |
| depth_from_m / depth_to_m | DECIMAL(7,2) (CHECK depth_to > depth_from) | ช่วงความลึก | ช่างกรอก |
| lithology_name | VARCHAR(120) | ชื่อชั้นดิน/หิน | ช่างกรอก |
| color_hex | CHAR(7) | สี (วาดรูปบ่อ) | ระบบ/ช่าง |
| hardness | ENUM `VERY_SOFT`/`SOFT`/`MEDIUM`/`HARD`/`VERY_HARD` | ความแข็ง | ช่างกรอก |
| water_bearing | TINYINT(1) | ชั้นให้น้ำ | ช่างกรอก |
| description | VARCHAR(255) | รายละเอียด | ช่างกรอก |

### 4.6 well_pipes — ท่อ

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| pipe_id | INT UNSIGNED (PK) | รหัสท่อ | อัตโนมัติ |
| well_id | INT UNSIGNED (FK, CASCADE) | บ่อ | ระบบโยง |
| material | ENUM `PVC`/`STEEL`/`STAINLESS_STEEL`/`HDPE`/`OTHER` | วัสดุ | ช่างกรอก |
| pipe_type | ENUM `CASING`(ทึบ)/`SCREEN`(เซาะร่อง) | ประเภท | ช่างกรอก |
| size_mm | DECIMAL(6,1) | เส้นผ่านศูนย์กลาง (มม.) | ช่างกรอก |
| depth_from_m / depth_to_m | DECIMAL(7,2) (CHECK) | ช่วงความลึก | ช่างกรอก |
| quantity | INT UNSIGNED default 1 | จำนวนท่อน | ช่างกรอก |
| notes | TEXT | หมายเหตุ | ช่างกรอก |

### 4.7 well_pumps — ปั๊ม

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| pump_id | INT UNSIGNED (PK) | รหัสปั๊ม | อัตโนมัติ |
| well_id | INT UNSIGNED (FK, CASCADE) | บ่อ | ระบบโยง |
| pump_type | ENUM `AC_SUBMERSIBLE`/`DC_SOLAR_SUBMERSIBLE`/`OTHER` | ชนิดปั๊ม | ช่างกรอก |
| brand | VARCHAR(100) | ยี่ห้อ | ช่างกรอก |
| horsepower / power_kw | DECIMAL(5,2) | แรงม้า/กิโลวัตต์ | ช่างกรอก |
| impeller_stages | INT | จำนวนใบพัด | ช่างกรอก |
| installation_depth_m | DECIMAL(7,2) | ความลึกติดตั้ง | ช่างกรอก |
| installed_date | DATE | วันที่ติดตั้ง | ช่างกรอก |
| notes | TEXT | หมายเหตุ | ช่างกรอก |

### 4.8 well_control_boxes — กล่องคอนโทรล

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| control_box_id | INT UNSIGNED (PK) | รหัส | อัตโนมัติ |
| well_id | INT UNSIGNED (FK, CASCADE) | บ่อ | ระบบโยง |
| brand / model | VARCHAR(100) | ยี่ห้อ/รุ่น | ช่างกรอก |
| capacity | VARCHAR(50) | ขนาด/กำลัง | ช่างกรอก |
| voltage | VARCHAR(50) | แรงดันไฟ | ช่างกรอก |
| installed_date | DATE | วันที่ติดตั้ง | ช่างกรอก |
| notes | TEXT | หมายเหตุ | ช่างกรอก |

### 4.9 drilling_requests — คำร้องแจ้งเจาะ

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| request_id | INT UNSIGNED (PK) | รหัสคำร้อง | อัตโนมัติ |
| customer_id | INT UNSIGNED (FK, CASCADE) | ลูกค้าผู้ร้อง | ระบบโยง |
| source | ENUM `GOOGLE_FORM`/`MANUAL`/`LINE` (default `GOOGLE_FORM`) | ต้นทางคำร้อง | ระบบบันทึก |
| name / phone / address | VARCHAR/TEXT NOT NULL | ชื่อ/เบอร์/ที่อยู่ | **Google Form** (webhook) |
| requested_depth_m | DECIMAL(7,2) | ความลึกที่ต้องการ | Google Form |
| status | ENUM `NEW`/`QUOTED`/`ACCEPTED`/`REJECTED`/`CANCELLED` (default `NEW`) | สถานะ | ระบบเปลี่ยนตาม flow |
| notes | TEXT | หมายเหตุ | ผู้ประกอบการ |
| created_at / updated_at | TIMESTAMP | เวลา | อัตโนมัติ |

### 4.10 drilling_jobs — คิวงานเจาะ (Queue Pool)

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| job_id | INT UNSIGNED (PK) | รหัสคิว | อัตโนมัติ |
| request_id | INT UNSIGNED (FK → drilling_requests, SET NULL) | คำร้องต้นทาง (NULL = กรอกเอง) | ระบบโยง |
| customer_id | INT UNSIGNED (FK, RESTRICT) | ลูกค้า | ระบบโยง |
| well_id | INT UNSIGNED (FK → wells, SET NULL) | บ่อ (ตั้งเมื่อเจาะสำเร็จ) | ระบบโยง |
| status | ENUM `QUEUED`/`DRILLING`/`SUCCESS`/`FAILED`/`CLOSED` (default `QUEUED`) | สถานะคิว | ระบบ/ช่าง |
| result | ENUM `SUCCESS`/`FAILED` | ผลเจาะ | ช่างกรอก |
| failure_reason | TEXT | เหตุผลไม่สำเร็จ | ช่างกรอก |
| job_title | VARCHAR(200) | ชื่องาน | ผู้ประกอบการ |
| site_address / province / district | TEXT/VARCHAR | ที่อยู่หน้างาน | ผู้ประกอบการ |
| scheduled_date | DATE (NULL ได้) | วันที่นัด (NULL = คิวไม่มีวันตายตัว) | ผู้ประกอบการ |
| magic_link_token | VARCHAR(100) UNIQUE | ลิงก์ช่าง (ไม่ต้อง login) | ระบบสร้าง |
| magic_link_expires_at | DATETIME | หมดอายุลิงก์ | ระบบสร้าง |
| notes | TEXT | หมายเหตุ | ผู้ประกอบการ |
| created_at / updated_at | TIMESTAMP | เวลา | อัตโนมัติ |

### 4.11 repair_requests — รายการแจ้งซ่อม

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| repair_id | INT UNSIGNED (PK) | รหัสคำร้องซ่อม | อัตโนมัติ |
| customer_id | INT UNSIGNED (FK, CASCADE) | ลูกค้า | ระบบโยง |
| well_id | INT UNSIGNED (FK → wells, SET NULL) | บ่อที่เลือก | ลูกค้าเลือกในฟอร์ม |
| problems | JSON NOT NULL | ปัญหาที่ติ๊ก `["ปั๊มไม่ทำงาน",...]` | ลูกค้าติ๊ก |
| detail | TEXT | รายละเอียดเพิ่มเติม | ลูกค้ากรอก |
| photos | JSON | URL รูปที่แนบ (array) | ลูกค้าแนบรูป |
| scheduled_date | DATE | วันนัดซ่อม | ลูกค้าเลือก |
| status | ENUM `NEW`/`QUOTED`/`ACCEPTED`/`REJECTED`/`SCHEDULED`/`IN_PROGRESS`/`COMPLETED`/`CANCELLED` (default `NEW`) | สถานะ | ระบบเปลี่ยนตาม flow |
| magic_link_token | VARCHAR(100) UNIQUE | ลิงก์ช่าง | ระบบสร้าง |
| magic_link_expires_at | DATETIME | หมดอายุลิงก์ | ระบบสร้าง |
| created_at / updated_at | TIMESTAMP | เวลา | อัตโนมัติ |

### 4.12 quotations — ราคาประเมิน (เจาะ + ซ่อม)

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| quotation_id | INT UNSIGNED (PK) | รหัสใบราคา | อัตโนมัติ |
| kind | ENUM `DRILLING`/`REPAIR` | ของเจาะหรือซ่อม | ผู้ประกอบการตั้ง |
| drilling_request_id | INT UNSIGNED (FK, RESTRICT) | โยงคำร้องเจาะ (เมื่อ kind=DRILLING) | ระบบโยง |
| repair_request_id | INT UNSIGNED (FK, RESTRICT) | โยงคำร้องซ่อม (เมื่อ kind=REPAIR) | ระบบโยง |
| price | DECIMAL(12,2) NOT NULL | ราคาที่ประเมิน | ผู้ประกอบการตีราคา |
| status | ENUM `PENDING`/`ACCEPTED`/`REJECTED` (default `PENDING`) | ยอมรับ/ปฏิเสธของลูกค้า | ลูกค้าตอบใน LINE |
| notes | TEXT | รายละเอียดราคา | ผู้ประกอบการ |
| created_at / updated_at | TIMESTAMP | เวลา | อัตโนมัติ |

**CHECK constraint:** `drilling_request_id` / `repair_request_id` ได้แค่ตัวเดียวที่ตรงกับ `kind`

### 4.13 repair_records — บันทึกหลังซ่อมเสร็จ

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| record_id | INT UNSIGNED (PK) | รหัสบันทึก | อัตโนมัติ |
| repair_id | INT UNSIGNED (FK, CASCADE) | คำร้องซ่อมที่ทำเสร็จ | ระบบโยง |
| final_price | DECIMAL(12,2) | ราคาจบงานจริง | ช่างกรอก |
| work_details | TEXT | รายละเอียดอะไหล่/งานที่ทำ | ช่างกรอก |
| parts | JSON | รายการอะไหล่ `[{"name","qty","unit_price"}]` | ช่างกรอก |
| payment_slip_url | VARCHAR(500) | สลิปจ่ายเงิน (URL) | ช่างอัปโหลด |
| is_warranty_claim | TINYINT(1) default 0 | ใช้สิทธิ์ประกัน | ช่าง/ระบบ |
| completed_at | DATETIME | เวลาซ่อมเสร็จ | ระบบ/ช่าง |
| created_at | TIMESTAMP | เวลาบันทึก | อัตโนมัติ |

### 4.14 line_notifications — log ส่งข้อความ LINE

| คอลัมน์ | ชนิด | ความหมาย | ที่มา |
|---|---|---|---|
| notification_id | INT UNSIGNED (PK) | รหัส | อัตโนมัติ |
| customer_id | INT UNSIGNED (FK, CASCADE) | ลูกค้าที่ส่งให้ | ระบบโยง |
| kind | ENUM `QUOTE`/`STATUS`/`REMINDER`/`OTHER` | ประเภทข้อความ | ระบบ |
| content | TEXT | ข้อความที่ส่ง | ระบบสร้าง |
| line_message_id | VARCHAR(100) | ID จาก LINE API | LINE API |
| status | ENUM `SENT`/`FAILED` (default `SENT`) | ส่งสำเร็จ/ไม่สำเร็จ | LINE API |
| sent_at | TIMESTAMP | เวลาส่ง | อัตโนมัติ |

### 4.15 well_warranty_view — สถานะประกัน (view อ่านอย่างเดียว)

คำนวณจาก `wells` JOIN `customers`:
- `days_left` = `DATEDIFF(warranty_expire_date, CURDATE())`
- `warranty_status` = `UNKNOWN` (ยังไม่มีวันเสร็จ) / `ACTIVE` (ในประกัน) / `EXPIRED` (หมด)

ใช้สำหรับ Flow C — เมื่อลูกค้าถามใน LINE bot เรื่องสถานะ-วันหมดอายุประกัน

---

## 5. สแตกเทคโนโลยี

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | Vue 3 + Vuetify 3 + Pinia + Vue Router + Vite |
| แผนที่ | Leaflet.js + OpenStreetMap |
| Backend | Node.js + Express + TypeScript |
| PDF | pdfkit |
| Database | MySQL 8 (docker-compose: MySQL + Adminer) — และมี schema Supabase (PostgreSQL) แยกไว้ใน `supabase/` |
| LINE | LINE OA + LIFF (ลูกค้า) + Messaging API (ส่งข้อความกลับ) |

## 6. หมายเหตุสำหรับการพัฒนา

- `warranty_expire_date` เป็น GENERATED column — ตั้งค่าเองไม่ได้ ระบบคำนวณ = completion_date + 2 ปี
- `quotations` บังคับ 1 ใบราคา ต่อ 1 คำร้อง (ผ่าน CHECK constraint)
- `scheduled_date` ในคิวงานเป็น NULL ได้ตามสเปก "Queue Pool แบบไม่มีวันที่ตายตัว"
- ช่างเข้าถึงงานผ่าน magic link เท่านั้น — ควรบังคับวันหมดอายุ (`magic_link_expires_at`)
- ข้อมูลลูกค้าที่มาจาก LINE มี `line_user_id` เป็นตัวผูกตัวตน (unique) — ใช้ดึงข้อมูลตอบบอทได้
