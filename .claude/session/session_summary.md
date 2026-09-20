# well-drilling-vue — Session Summary

## Objective
แก้บั๊กที่ผู้ใช้รายงาน: "สร้างองค์กรเองเป็นเจ้าขององค์กร แต่แก้ไขหรือบันทึกข้อมูลในหน้าตั้งค่ายังไงก็ไม่ได้ — แก้ไขเรื่องสิทธิ์ทั้งเว็บไซต์เลย"

## Completed

- ตรวจสอบ register ใน `backend/src/controllers/auth.controller.ts:72` แล้วพบว่าโค้ดถูกอยู่แล้ว: `const USER_ROLE: UserRole = inviteCode ? "DRILLER" : "ADMIN"` — ผู้สร้าง org ใหม่ได้เป็น ADMIN, ผู้เข้าร่วมผ่าน invite ได้ DRILLER, และ INSERT users แบบ 6 คอลัมน์/6 params (email, password_hash, full_name, phone, role, org_id) ตรงกันหมด

- สรุปสาเหตุที่แท้จริงของบั๊ก: ไม่ใช่ register (ใหม่) แต่เป็น **องค์กรที่ถูกสร้างก่อนหน้าการแก้ไขนี้** — ผู้สร้างถูก lock ไว้ที่ `DRILLER` ถาวร ไม่มี ADMIN ใน org เลย → adminMiddleware ของทุก endpoint ในหน้าตั้งค่า (บันทึก LINE settings, หมุน/เปลี่ยน invite code, จัดการทีม/บทบาท, ลบสมาชิก, pump catalog) ปฏิเสธการใช้งานหมด

- แก้ฝั่งข้อมูลด้วย migration backfill 2 ชุด (ยึดชื่อตาม 0006_invite_code_backfill):
  - `supabase/migrations/0007_promote_org_creators.sql`
  - `backend/src/db/migration_promote_org_creators.sql`
  - หลักการ: แต่ละ org ที่ยังไม่มี ADMIN เลย → โปรโมตผู้ใช้ที่สร้างขึ้นเป็นคนแรกสุด (creator, `created_at` น้อยสุด) เป็น ADMIN

- ตรวจสอบ param count ใน INSERT users เจอว่าเดิมเขียน 7 placeholders + 6 params → แก้เป็น 6 คอลัมน์/6 params และอัปเดต test ให้ตรง (role อยู่ index 4)

- ยืนยันทั้งระบบ:
  - Backend `npx vitest run` ผ่านครบ 22 ไฟล์ / 229 tests (รวม auth.controller 36)
  - Backend `npm run build` (tsc -b) ผ่าน
  - Frontend `npm run build` ผ่าน

## Active

- **ยังไม่ได้รัน backfill migration ลงฐานข้อมูลจริง** — migration ถูกสร้างไฟล์ไว้แล้ว แต่ยังต้องให้ผู้ใช้รันหนึ่งครั้งใน Supabase SQL Editor / psql (`backend/src/db/migration_promote_org_creators.sql`) เพื่อโปรโมตเจ้าของ org เก่าที่ค้าง DRILLER เป็น ADMIN
- หลังรัน backfill: เจ้าของ org เก่าต้อง logout แล้ว login ใหม่อีกครั้งเพื่อ refresh token/บทบาท (role ถูกฝังใน JWT) แล้วจะบันทึกหน้าตั้งค่าได้ครบทุกส่วน
