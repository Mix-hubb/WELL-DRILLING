# Load Test ระบบ WELL-DRILLING

## ติดตั้ง k6
```bash
winget install k6 --source winget
```

## วิธีใช้งาน

### 1. Warm up (ปลุก Render)
```bash
k6 run warm-up.js
```
รอจน Render ตื่น (~30 วินาที)

### 2. สร้าง Test Account
```bash
curl -X POST https://well-drilling-api.onrender.com/api/auth/register ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"loadtest_user@test.com\",\"password\":\"test123456\",\"full_name\":\"Load Test User\",\"phone\":\"0899999999\",\"org_name\":\"LoadTest Org\"}"
```

### 3. Run Load Test
```bash
k6 run load-test.js
```

### 4. กำหนด Test Account เอง
```bash
k6 run --env TEST_EMAIL=my@email.com --env TEST_PASSWORD=mypass load-test.js
```

## ผลลัพธ์

### ดูผลแบบ real-time
k6 จะแสดงผลระหว่างรันทันที

### ดูผลละเอียด
ไฟล์ `load-test-results.json` จะถูกสร้างอัตโนมัติหลังรันจบ

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
Stage 1: 30 sec @ 5 VUs   (Warm up)
Stage 2: 30 sec @ 10 VUs  (Baseline)
Stage 3: 30 sec @ 20 VUs  (Moderate)
Stage 4: 30 sec @ 50 VUs  (High load)
Stage 5: 30 sec @ 0 VUs   (Cool down)
```

**Total: ~2.5 นาที**
