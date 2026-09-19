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

| ตัวแปร                                                           | ใช้สำหรับ                                      |
| ---------------------------------------------------------------- | ---------------------------------------------- |
| `PORT`                                                           | พอร์ต API                                      |
| `DATABASE_URL`                                                   | PostgreSQL connection string สำหรับ production |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`        | การเชื่อมต่อ PostgreSQL แบบแยกค่า              |
| `DB_SSL`                                                         | เปิด SSL ของฐานข้อมูล                          |
| `CORS_ORIGIN`                                                    | URL ของ frontend                               |
| `JWT_SECRET`                                                     | secret สำหรับ JWT                              |
| `APP_URL`                                                        | URL ที่ใช้สร้างลิงก์กลับไป frontend            |
| `LINE_CHANNEL_SECRET`                                            | LINE channel secret แบบ legacy/single-org      |
| `LINE_CHANNEL_ACCESS_TOKEN`                                      | LINE access token แบบ legacy/single-org        |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`  | ส่ง email reset password                       |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | ส่ง SMS OTP                                    |

การตั้งค่า LINE แบบหลายองค์กรเก็บในตาราง `organizations` และรองรับ `line_bot_user_id`, LIFF IDs และ access token แยกองค์กร

### Frontend ที่สำคัญ

| ตัวแปร                  | ใช้สำหรับ                                    |
| ----------------------- | -------------------------------------------- |
| `VITE_API_URL`          | URL ของ backend API                          |
| `VITE_LIFF_ID_DRILLING` | LIFF สำหรับแจ้งเจาะ ถ้าไม่ได้ใช้ค่าจากองค์กร |
| `VITE_LIFF_ID_REPAIR`   | LIFF สำหรับแจ้งซ่อม ถ้าไม่ได้ใช้ค่าจากองค์กร |

## API และ realtime

Backend ใช้ prefix `/api` ตัวอย่าง endpoint หลัก:

| Method | Endpoint              | รายละเอียด          |
| ------ | --------------------- | ------------------- |
| `POST` | `/api/auth/login`     | เข้าสู่ระบบ         |
| `GET`  | `/api/jobs`           | รายการงานเจาะ       |
| `GET`  | `/api/wells`          | รายการบ่อ           |
| `GET`  | `/api/customers`      | รายการลูกค้า        |
| `GET`  | `/api/stats/overview` | สถิติ dashboard     |
| `GET`  | `/api/events`         | SSE realtime stream |
| `POST` | `/api/webhooks/line`  | LINE webhook        |

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

### CI/CD

GitLab CI ทำงานตามลำดับ test, security scan, build, deploy และ smoke test โดย test backend/frontend ทำงานแบบขนาน และ deploy เฉพาะ branch `main`

ต้องตั้งค่า CI/CD Variables ใน GitLab ดังนี้:

- `RENDER_DEPLOY_HOOK_URL` สำหรับ trigger deploy backend
- `VERCEL_DEPLOY_HOOK_URL` สำหรับ trigger deploy frontend
- `SLACK_WEBHOOK_URL` (ถ้าต้องการรับ notification)
- `FRONTEND_URL` (ถ้าต้องการให้ smoke test ตรวจ frontend ด้วย)

Build artifacts ถูกตั้งชื่อด้วย commit SHA เพื่อให้ระบุเวอร์ชันได้ ส่วน rollback แบบ provider-native และ artifact registry ต้องตั้งค่า API/registry credentials เพิ่มเติมก่อนเปิดใช้งาน

### Database Operations

- `scripts/db-migrate.sh` รัน Supabase migrations ตามลำดับ แล้วตามด้วย multi-tenant และ performance migrations ด้วย `ON_ERROR_STOP`
- `scripts/db-backup.sh` สร้าง PostgreSQL custom-format dump พร้อม SHA-256 checksum
- `scripts/db-restore.sh` restore ได้เมื่อกำหนด `CONFIRM_RESTORE=YES` เท่านั้น
- GitLab มี manual jobs ชื่อ `database-migrate`, `database-backup` และ `database-restore` สำหรับ `main`; restore จะดาวน์โหลด artifact จาก backup job ล่าสุดใน pipeline เดียวกัน

ตั้งค่า `DATABASE_URL` เป็น protected/masked CI variable และเก็บ backup artifact ไว้ใน storage ที่มี retention แยกจาก GitLab job artifacts ก่อนใช้งานจริง

### Integration และ E2E

- Backend tenant isolation test: `cd backend; npm run test:integration`
- Frontend Playwright test: `cd frontend; npm run test:e2e`
- GitLab จะรัน integration test เมื่อมี `INTEGRATION_DATABASE_URL`
- GitLab จะรัน E2E เมื่อมี `E2E_BASE_URL` เช่น staging URL

ตั้งค่า `INTEGRATION_DATABASE_URL` เป็นฐานข้อมูลทดสอบแยกจาก production เท่านั้น และตั้ง `E2E_BASE_URL` เป็น staging พร้อมข้อมูลทดสอบ ห้ามใช้บัญชี production ใน E2E

### Observability

ทุก request มี `X-Request-Id` และ JSON log ที่มี method, path, status, duration, user และ organization context เพื่อค้นหาใน Render logs ได้ โดยไม่บันทึก JWT หรือ request body

Backend และ frontend security scan เป็น quality gate แล้ว โดยตรวจ high/critical vulnerabilities ก่อน build และ deploy หลังอัปเกรด Nodemailer เป็น `10.0.10`, Vite เป็น `8.3.0` และ Vitest เป็น `5.0.1`

## ความปลอดภัยของไฟล์

ห้าม commit `.env`, token, password, database credentials, build output หรือไฟล์ upload จริง ไฟล์ตัวอย่างที่ commit ได้ควรใช้ชื่อ `.env.example`

## License

MIT
