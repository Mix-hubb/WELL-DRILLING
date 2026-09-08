# ระบบจัดการบ่อบาดาล — Well-Drilling

เวอร์ชัน TypeScript เต็มระบบ (frontend + backend) สำหรับจัดการคิวเจาะ ซ่อม ประวัติบ่อ และลูกค้า

```
well-drilling/
├── backend/                          Node.js + Express + TypeScript REST API
│   └── src/
│       ├── config/db.ts              PostgreSQL connection pool
│       ├── controllers/              auth / drillers / customers / jobs / wells / stats
│       ├── routes/                   endpoint แยกไฟล์ตาม resource
│       ├── services/                 email (nodemailer) + sms (twilio) + resetCode
│       ├── middleware/auth.ts        JWT sign / verify / authMiddleware
│       ├── utils/pdfReport.ts        สร้างรายงาน PDF ด้วย pdfkit
│       ├── types/index.ts            interface ร่วมของข้อมูล
│       └── db/local_schema.sql       schema สำหรับ local dev
├── frontend/                         Vue 3 + TypeScript + Vuetify 3 + Pinia
│   └── src/
│       ├── api/                      fetch client แยกตาม resource
│       ├── stores/                   Pinia store (auth, jobs, wells, customers, ui)
│       ├── components/               StrataColumn, DonutChart, BarChart, JobMap, ...
│       ├── components/forms/         v-dialog ฟอร์มแต่ละประเภท
│       ├── views/                    Dashboard, Jobs, Wells, Login, Register, ForgotPassword, ...
│       └── router/                   Vue Router + auth guard
├── supabase/                         PostgreSQL migrations
└── README.md
```

## ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---------|-----------|
| **เข้าสู่ระบบ / ลงทะเบียน** | JWT auth, email validation, เบอร์โทรบังคับกรอก |
| **กู้คืนรหัสผ่าน** | เลือกรหัสผ่านทาง Email หรือ SMS OTP — 6 หลัก หมดอายุ 10 นาที |
| **แดชบอร์ด** | สรุปคิวงาน/บ่อ/รายได้ พร้อมกราฟโดนัท + กราฟแท่ง (SVG ล้วน) |
| **แผนที่คิวงาน** | Leaflet + OpenStreetMap ปักหมุดตามสถานะ คลิกดูรายละเอียด |
| **ออกรายงาน PDF** | pdfkit — ชั้นดิน/หิน, ท่อ, ปั๊ม ดาวน์โหลดทันที |
| **สลับธีมสว่าง/มืด** | Earth-tone design system จำค่าไว้ใน localStorage |
| **Stepper ความคืบหน้า** | PENDING → DRILLING → COMPLETED visual step |
| **GPS + คัดลอกพิกัด** | ดึงตำแหน่งปัจจุบัน เปิด Google Maps |
| **ค้นหาทันที** | Real-time filter ในหน้าคิวงาน/ลูกค้า/ทีมช่าง |
| **Responsive** | Navigation rail (desktop) + bottom navigation (mobile) |
| **LINE Integration** | แจ้งเตือนผ่าน LINE LIFF สำหรับลูกค้า |

## เริ่มต้นใช้งาน

### 1) ตั้งฐานข้อมูล Supabase

รัน migration ใน Supabase SQL Editor ตามลำดับ:

```sql
-- 1. ตารางหลัก
-- เปิดไฟล์ supabase/migrations/0001_init.sql แล้วรัน

-- 2. well detail + pump catalog
-- เปิดไฟล์ supabase/migrations/0002_well_detail_and_pump_catalog.sql แล้วรัน

-- 3. password reset columns
-- เปิดไฟล์ supabase/migrations/0003_password_reset.sql แล้วรัน
```

### 2) Backend (TypeScript)

```bash
cd backend
cp .env.example .env     # แก้ไขค่า env ตามต้องการ
npm install
npm run dev              # http://localhost:4001 (ts-node-dev, hot reload)
```

Build สำหรับ production: `npm run build && npm start`

### 3) Frontend (Vue 3 + Vuetify)

```bash
cd frontend
npm install
npm run dev              # http://localhost:5173
```

## Environment Variables

### Backend (`backend/.env`)

| ตัวแปร | คำอธิบาย | ค่าเริ่มต้น |
|--------|---------|------------|
| `PORT` | พอร์ต backend | `4001` |
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USER` | PostgreSQL user | `postgres` |
| `DB_PASSWORD` | PostgreSQL password | - |
| `DB_NAME` | Database name | `well_drilling` |
| `DB_SSL` | เปิด SSL | `false` |
| `CORS_ORIGIN` | Frontend URL | `http://localhost:5173` |
| `JWT_SECRET` | Secret key สำหรับ JWT | - |
| `APP_URL` | Frontend URL | `http://localhost:5173` |
| `LINE_CHANNEL_SECRET` | LINE Messaging secret | - |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Messaging token | - |
| `SMTP_HOST` | SMTP host สำหรับส่งอีเมล | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | อีเมลผู้ส่ง | - |
| `SMTP_PASS` | รหัสผ่านอีเมล (App Password) | - |
| `SMTP_FROM` | ชื่อผู้ส่ง | `noreply@well-drilling.com` |
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | - |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | - |
| `TWILIO_PHONE_NUMBER` | เบอร์ Twilio | - |

### Frontend (`frontend/.env`)

| ตัวแปร | คำอธิบาย |
|--------|---------|
| `VITE_API_URL` | Backend API URL |
| `VITE_LIFF_ID_DRILLING` | LINE LIFF ID สำหรับแจ้งเจาะ |
| `VITE_LIFF_ID_REPAIR` | LINE LIFF ID สำหรับแจ้งซ่อม |

## สร้าง Gmail App Password (สำหรับส่งอีเมล Reset)

1. ไปที่ [myaccount.google.com/security](https://myaccount.google.com/security)
2. เปิด 2-Step Verification (ถ้ายังไม่ได้เปิด)
3. ไปที่ App passwords → สร้างใหม่
4. คัดลอก password 16 ตัวอักษร ใส่ใน `SMTP_PASS`

## สร้าง Twilio Account (สำหรับส่ง SMS OTP)

1. ไปที่ [twilio.com](https://www.twilio.com) → สมัครบัญชี
2. ได้รับ Trial Credit $15
3. ไปที่ Console → Dashboard → คัดลอก `Account SID` และ `Auth Token`
4. ซื้อเบอร์โทร → คัดลอกเบอร์ใส่ใน `TWILIO_PHONE_NUMBER`

## API Endpoints

### Auth

| Method | Path | คำอธิบาย | Auth |
|--------|------|---------|------|
| POST | `/api/auth/register` | ลงทะเบียน (email, password, full_name, phone) | ไม่ |
| POST | `/api/auth/login` | เข้าสู่ระบบ | ไม่ |
| GET | `/api/auth/me` | ข้อมูลผู้ใช้ปัจจุบัน | ใช่ |
| POST | `/api/auth/forgot-password` | ส่งรหัส reset (email/sms) | ไม่ |
| POST | `/api/auth/verify-code` | ตรวจสอบรหัส 6 หลัก | ไม่ |
| POST | `/api/auth/reset-password` | เปลี่ยนรหัสผ่านใหม่ | ไม่ |

### Other

| Method | Path | คำอธิบาย | Auth |
|--------|------|---------|------|
| GET | `/api/jobs` | รายการคิวงาน | ใช่ |
| GET | `/api/wells` | รายการบ่อ | ใช่ |
| GET | `/api/customers` | รายการลูกค้า | ใช่ |
| GET | `/api/drillers` | รายการช่าง | ใช่ |
| GET | `/api/stats/dashboard` | สรุปแดชบอร์ด | ใช่ |
| GET | `/api/wells/:id/report.pdf` | ดาวน์โหลด PDF | ใช่ |

## สแตกเทคโนโลยี

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | Vue 3 (`<script setup lang="ts">`) + Vuetify 3 + Pinia + Vue Router + Vite |
| แผนที่ | Leaflet.js + OpenStreetMap tiles |
| Backend | Node.js + Express + TypeScript |
| Auth | JWT (7 days) + bcryptjs |
| Email | Nodemailer (SMTP) |
| SMS | Twilio |
| PDF | pdfkit |
| Database | PostgreSQL บน Supabase |
| LINE | LINE LIFF SDK |

## โครงสร้าง Database

```sql
users              -- ผู้ใช้ (email, password_hash, phone, role)
customers          -- ลูกค้า
wells              -- บ่อ (ผูกกับ customer)
well_strata_logs   -- ชั้นดิน/หิน
well_pipes         -- ท่อ
well_pumps         -- ปั๊ม
control_boxes      -- กล่องควบคุม
drilling_requests  -- คำร้องแจ้งเจาะ
drilling_jobs      -- คิวงานเจาะ
repair_requests    -- คำร้องแจ้งซ่อม
quotations         -- ใบเสนอราคา
repair_records     -- บันทึกการซ่อม
line_notifications -- แจ้งเตือน LINE
```

## Deploy

| บริการ | ใช้สำหรับ |
|--------|----------|
| Vercel | Frontend (auto deploy จาก GitHub) |
| Render | Backend (auto deploy จาก GitHub) |
| Supabase | PostgreSQL database |

### Checklist ก่อน Deploy

```
□ รัน migration 0003_password_reset.sql บน Supabase
□ ตั้ง SMTP env vars บน Render
□ ตั้ง Twilio env vars บน Render
□ Push code → auto deploy
```

## License

MIT
