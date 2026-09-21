# Load Test ระบบ WELL-DRILLING

## ติดตั้ง k6
```bash
winget install k6 --source winget
```

## วิธีใช้งาน

สคริปต์ชี้ไปที่ `http://localhost:4001` (backend local) โดย default — **ต้องรัน backend + database ในเครื่องก่อน** (`cd backend && npm run dev`) มิฉะนั้นทุก request จะ fail ทันที

### 1. Warm up (health check เบื้องต้น)
```bash
k6 run warm-up.js
```
ต่อ localhost ไม่จำเป็นต้อง warm up จริงจัง (ไม่มีปัญหา cold start แบบ Render free tier) แต่ใช้เช็คว่า backend พร้อมตอบสนองก่อนยิง load จริง

### 2. Run Load Test
```bash
k6 run load-test.js
```
สคริปต์จะลงทะเบียนบัญชีทดสอบแบบใช้แล้วทิ้งให้อัตโนมัติผ่าน `setup()` (อีเมลสุ่มด้วย timestamp ทุกครั้งที่รัน) ไม่ต้องสร้างบัญชีเองอีกต่อไป

### 3. ชี้ไปยัง Environment อื่น (ไม่ใช่ localhost)
```bash
k6 run --env BASE_URL=https://your-staging-url load-test.js
```
**ห้ามชี้ไปที่ Production โดยไม่ตั้งใจ** — ค่า default ปลอดภัย (localhost) แต่ถ้าจำเป็นต้องทดสอบ environment อื่น ให้แน่ใจว่าเป็น staging ที่ยอมรับโหลดทดสอบได้ ไม่ใช่ production จริงที่ผู้ใช้งานจริงใช้อยู่

## ผลลัพธ์

### ดูผลแบบ real-time
k6 จะแสดงผลระหว่างรันทันที

### ดูผลละเอียด
- `load-test-results.json` — สรุปตัวเลขแบบ JSON ถูกสร้างอัตโนมัติหลังรันจบ (ทับไฟล์เดิมทุกครั้ง)
- `report.html` — รายงานแบบกราฟ/ตาราง เปิดดูในเบราว์เซอร์ได้ (ทับไฟล์เดิมทุกครั้ง)

### Metrics ที่วัด

| Metric | คำอธิบาย |
|---|---|
| `http_req_duration` | เวลาตอบสนอง (ms) |
| `p(95)` | 95% ของ requests ตอบในเวลาเท่าไหร่ |
| `p(99)` | 99% ของ requests ตอบในเวลาเท่าไหร่ |
| `errors` | อัตรา error (%) |
| `http_reqs` | จำนวน requests ทั้งหมด |
| `http_reqs_per_second` | จำนวน requests ต่อวินาที |

### วิธีอ่านผล

| สถานะ | p95 | Error Rate |
|---|---|---|
| OK | < 500ms | < 1% |
| Degradation | 500ms–2s | 1–5% |
| Overloaded | > 2s | > 5% |

## Staged Load Test

```
Stage 1: 20 sec  0→5 VUs   (Warm up)
Stage 2: 30 sec  5→10 VUs  (Baseline)
Stage 3: 30 sec  10→20 VUs (Moderate)
Stage 4: 30 sec  20→50 VUs (High load)
Stage 5: 20 sec  50→0 VUs  (Cool down)
```

**Total: ~2.2 นาที**

## หมายเหตุด้านความปลอดภัย

- ค่า default ของ `apiLimiter` (60 req/นาที/IP) และ `authLimiter` (10 ครั้ง/15 นาที/IP) ของ backend อาจทำให้ผล Load Test ที่ VU สูงๆ สะท้อน rate limiter แทนที่จะสะท้อนขีดจำกัดจริงของระบบ เมื่อทดสอบแบบ local ทุก VU ยิงจาก IP เดียวกัน (loopback) — หากต้องการวัดขีดจำกัดจริงของ backend ให้ตั้งค่า `RATE_LIMIT_API_MAX` / `RATE_LIMIT_AUTH_MAX` ใน `backend/.env` ให้สูงขึ้นชั่วคราวเฉพาะตอนทดสอบ (ค่า default ในโค้ดที่ใช้ตอน production ไม่เปลี่ยน)
- อย่ารัน k6 และชุด E2E test (Playwright) พร้อมกัน — ทั้งสองใช้ `/api/auth` ร่วมกันและอาจชน authLimiter budget เดียวกัน
