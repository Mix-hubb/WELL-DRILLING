# ระบบจัดการบ่อบาดาล — TypeScript + Vue 3 + Vuetify + Node.js

เวอร์ชัน TypeScript เต็มระบบ (frontend + backend) พร้อมลูกเล่นเพิ่มเติมจากเวอร์ชันก่อนหน้า

```
well-drilling-vue/
├── backend/                          Node.js + Express + TypeScript REST API
│   └── src/
│       ├── config/db.ts              MySQL connection pool
│       ├── controllers/              drillers / customers / jobs / wells / stats
│       ├── routes/                   endpoint แยกไฟล์ตาม resource
│       ├── utils/pdfReport.ts        สร้างรายงาน PDF ด้วย pdfkit
│       ├── types/index.ts            interface ร่วมของข้อมูล
│       └── db/schema.sql, seed.sql   schema เดิม (7 ตาราง) + ข้อมูลตัวอย่าง
├── frontend/                         Vue 3 + TypeScript + Vuetify 3 + Pinia
│   └── src/
│       ├── api/                      fetch client แยกตาม resource
│       ├── stores/                   Pinia store (jobs, wells, customers, drillers, ui)
│       ├── components/               StrataColumn, DonutChart, BarChart, JobMap, ...
│       ├── components/forms/         v-dialog ฟอร์มแต่ละประเภท แยกไฟล์
│       ├── views/                    Dashboard, Jobs, JobDetail, Wells, WellDetail, Map, Customers, Drillers
│       └── router/                   Vue Router
├── docker-compose.yml                MySQL + Adminer พร้อม auto-load schema/seed
└── README.md
```

## ลูกเล่นที่เพิ่มเข้ามา

| ฟีเจอร์ | รายละเอียด |
|---|---|
| 📊 **แดชบอร์ด** | สรุปคิวงาน/บ่อ/รายได้ พร้อมกราฟโดนัท (สัดส่วนสถานะ) และกราฟแท่ง (ชั้นดิน/หิน สะสม, ภาระงานทีมช่าง) — วาดด้วย SVG ล้วน ไม่ต้องพึ่ง library กราฟภายนอก |
| 🗺️ **แผนที่คิวงาน** | ปักหมุดตำแหน่งหน้างานทุกคิวด้วย Leaflet + OpenStreetMap สีหมุดตามสถานะ กรองได้ คลิกหมุดเพื่อดูรายละเอียด |
| 📄 **ออกรายงาน PDF** | ปุ่ม "ออกรายงาน PDF" ในหน้าประวัติบ่อ เรียก backend endpoint ที่สร้างรายงานสรุปด้วย `pdfkit` (ชั้นดิน/หิน, ท่อ, ปั๊ม) ดาวน์โหลดได้ทันที |
| 🌗 **สลับธีมสว่าง/มืด** | ปุ่มมุมขวาบน จำค่าไว้ใน localStorage |
| 🧭 **Stepper ความคืบหน้า** | หน้ารายละเอียดคิวงานแสดงขั้นตอน PENDING → DRILLING → COMPLETED แบบ visual step แตะเพื่อเปลี่ยนสถานะได้ทันที |
| 📍 **GPS + คัดลอกพิกัด** | ปุ่มดึงพิกัดปัจจุบันตอนสร้างคิวงาน และปุ่มคัดลอก/เปิด Google Maps ในหน้ารายละเอียด |
| 🔍 **ค้นหาทันที** | ช่องค้นหาในหน้าคิวงาน/ลูกค้า/ทีมช่าง กรองแบบ real-time โดยไม่ต้องเรียก API ใหม่ |
| 📱 **Responsive shell** | Navigation rail (hover ขยาย) บนเดสก์ท็อป และ bottom navigation บนมือถือ ผ่าน Vuetify `useDisplay()` |

## เริ่มต้นใช้งาน

### 1) ตั้งฐานข้อมูล MySQL

```bash
docker compose up -d
```
MySQL ที่ `localhost:3306` (root / password / DB `well_drilling`) และ Adminer ที่ `http://localhost:8080`

### 2) Backend (TypeScript)

```bash
cd backend
cp .env.example .env
npm install
npm run dev        # http://localhost:4000  (ts-node-dev, hot reload)
```

Build สำหรับ production: `npm run build && npm start`

### 3) Frontend (Vue 3 + Vuetify)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev         # http://localhost:5173
```

## สแตกเทคโนโลยี

| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | Vue 3 (`<script setup lang="ts">`) + Vuetify 3 + Pinia + Vue Router + Vite |
| แผนที่ | Leaflet.js + OpenStreetMap tiles |
| Backend | Node.js + Express + TypeScript (`ts-node-dev` ระหว่างพัฒนา, `tsc` build) |
| PDF | pdfkit (สตรีมไฟล์ตรงจาก endpoint `/api/wells/:id/report.pdf`) |
| Database | MySQL 8 (InnoDB) — schema เดิมจากสเปกต้นฉบับ 7 ตาราง |
| Container | Docker / docker-compose (MySQL + Adminer) |

## Type Safety

Type ของโมเดลข้อมูล (`DrillingJob`, `WellLog`, `WellStrataLog`, ...) ประกาศคู่กันทั้งฝั่ง
`backend/src/types/index.ts` และ `frontend/src/types/index.ts` ให้ตรงกับ ENUM ในฐานข้อมูลเป๊ะๆ
เพื่อให้ compiler ช่วยจับ mismatch ตั้งแต่ตอนพัฒนา

## Deploy จริง

- Frontend → Vercel/Netlify (`npm run build`, ตั้ง `VITE_API_URL`)
- Backend → Railway/Render (`npm run build && npm start`, ตั้ง env ตาม `.env.example`)
- Database → Railway/Render MySQL หรือ PlanetScale
