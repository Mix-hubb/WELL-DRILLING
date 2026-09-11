# Well-Drilling

ระบบจัดการงานเจาะบ่อบาดาล งานซ่อม ลูกค้า บ่อ ปั๊ม ใบเสนอราคา และการแจ้งเตือนผ่าน LINE

โปรเจกต์แบ่งเป็น Vue frontend, Express backend และ PostgreSQL database โดยรองรับการใช้งานหลายองค์กรผ่าน `org_id`

## ฟีเจอร์หลัก

- JWT authentication พร้อมสมัครสมาชิกและ reset password ผ่าน email/SMS
- Dashboard สำหรับงานเจาะ งานซ่อม ลูกค้า บ่อ และสถิติ
- จัดการคำร้องเจาะบ่อ ใบเสนอราคา คิวงาน และสถานะงาน
- จัดการคำร้องซ่อม ใบเสนอราคา นัดหมาย ประวัติซ่อม และสลิปโอนเงิน
- บันทึกรายละเอียดบ่อ: ชั้นดิน/หิน โปรแกรมท่อ ปั๊ม และตู้ควบคุม
- สร้างรายงานบ่อเป็น PDF
- หน้า Driller สำหรับกรอกผลเจาะและบันทึกงานซ่อมผ่าน magic link
- LINE LIFF สำหรับแจ้งเจาะและแจ้งซ่อม
- LINE webhook สำหรับตอบข้อมูลบ่อ สถานะประกัน และประวัติซ่อมเป็น Flex card
- Server-Sent Events (SSE) สำหรับ refresh ข้อมูลแบบ realtime ในหน้าหลัก
- รองรับ light/dark theme และ responsive layout

## โครงสร้างโปรเจกต์

```text
backend/       Express + TypeScript API, controllers, routes, services
frontend/      Vue 3 + TypeScript + Vuetify + Pinia + Vite
supabase/      PostgreSQL migrations และ Supabase config
loadtest/      สคริปต์ load test
render.yaml    Render deployment configuration
```

## ความต้องการของระบบ

- Node.js 20 ขึ้นไป
- PostgreSQL หรือ Supabase PostgreSQL
- npm

## เริ่มต้นใช้งาน

### 1. ติดตั้งฐานข้อมูล

รัน migration ใน `supabase/migrations` ตามลำดับ:

```text
0001_init.sql
0002_well_detail_and_pump_catalog.sql
0003_password_reset.sql
0004_payment_slips_and_line_bot_user_id.sql
```

สามารถใช้ Supabase SQL Editor หรือ PostgreSQL client ได้

### 2. ตั้งค่า Backend

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

Backend จะทำงานที่ `http://localhost:4001` โดยค่าเริ่มต้น

คำสั่งที่ใช้บ่อย:

```powershell
npm run build
npm test
npm start
```

### 3. ตั้งค่า Frontend

```powershell
cd frontend
Copy-Item .env.example .env
npm install
npm run dev
```

Frontend จะทำงานที่ `http://localhost:5173` โดยค่าเริ่มต้น

คำสั่งที่ใช้บ่อย:

```powershell
npm run build
npm test
npm run preview
```

## Environment variables

ดูตัวอย่างได้จาก `backend/.env.example` และ `frontend/.env.example`

### Backend ที่สำคัญ

| ตัวแปร | ใช้สำหรับ |
|---|---|
| `PORT` | พอร์ต API |
| `DATABASE_URL` | PostgreSQL connection string สำหรับ production |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | การเชื่อมต่อ PostgreSQL แบบแยกค่า |
| `DB_SSL` | เปิด SSL ของฐานข้อมูล |
| `CORS_ORIGIN` | URL ของ frontend |
| `JWT_SECRET` | secret สำหรับ JWT |
| `APP_URL` | URL ที่ใช้สร้างลิงก์กลับไป frontend |
| `LINE_CHANNEL_SECRET` | LINE channel secret แบบ legacy/single-org |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE access token แบบ legacy/single-org |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | ส่ง email reset password |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | ส่ง SMS OTP |

การตั้งค่า LINE แบบหลายองค์กรเก็บในตาราง `organizations` และรองรับ `line_bot_user_id`, LIFF IDs และ access token แยกองค์กร

### Frontend ที่สำคัญ

| ตัวแปร | ใช้สำหรับ |
|---|---|
| `VITE_API_URL` | URL ของ backend API |
| `VITE_LIFF_ID_DRILLING` | LIFF สำหรับแจ้งเจาะ ถ้าไม่ได้ใช้ค่าจากองค์กร |
| `VITE_LIFF_ID_REPAIR` | LIFF สำหรับแจ้งซ่อม ถ้าไม่ได้ใช้ค่าจากองค์กร |

## API และ realtime

Backend ใช้ prefix `/api` ตัวอย่าง endpoint หลัก:

| Method | Endpoint | รายละเอียด |
|---|---|---|
| `POST` | `/api/auth/login` | เข้าสู่ระบบ |
| `GET` | `/api/jobs` | รายการงานเจาะ |
| `GET` | `/api/wells` | รายการบ่อ |
| `GET` | `/api/customers` | รายการลูกค้า |
| `GET` | `/api/stats/overview` | สถิติ dashboard |
| `GET` | `/api/events` | SSE realtime stream |
| `POST` | `/api/webhooks/line` | LINE webhook |

หน้า dashboard, jobs, requests, wells และรายละเอียดที่เกี่ยวข้องจะ refresh เมื่อได้รับ event จาก SSE เช่น job, request, quotation, well, customer และ repair record changes

## LINE

LINE webhook รองรับ:

- ข้อความ `ข้อมูลบ่อ` แสดงข้อมูลเป็น Flex carousel
- ข้อความ `ประกัน` แสดงสถานะประกันเป็น Flex card
- ข้อความ `ประวัติซ่อม` แสดงประวัติเป็น Flex card
- ข้อความ `แจ้งเจาะ` และ `แจ้งซ่อม` ส่งลิงก์ LIFF
- รูปภาพจากลูกค้าใช้รับสลิปโอนเงินสำหรับงานซ่อม

ตั้ง webhook URL เป็น:

```text
https://<backend-domain>/api/webhooks/line
```

## Deploy

- Frontend: Vercel โดยใช้ `frontend/vercel.json`
- Backend: Render โดยใช้ `render.yaml` และ `backend/Dockerfile`
- Database: Supabase PostgreSQL

ก่อน deploy ให้ตรวจสอบว่า environment variables, CORS origin, LINE webhook URL และ migrations ครบถ้วน

## ความปลอดภัยของไฟล์

ห้าม commit `.env`, token, password, database credentials, build output หรือไฟล์ upload จริง ไฟล์ตัวอย่างที่ commit ได้ควรใช้ชื่อ `.env.example`

## License

MIT
