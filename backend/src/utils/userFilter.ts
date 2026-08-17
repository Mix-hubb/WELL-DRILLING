import { Request } from "express";

// สิทธิ์เดียวคือ USER (ผู้ประกอบการ) — เห็นข้อมูลทั้งหมดร่วมกัน
export function userFilter(_req: Request, _alias = "c"): { sql: string; params: any[] } {
  return { sql: "", params: [] };
}

export function userWhere(_req: Request, _alias = "c"): { sql: string; params: any[] } {
  return { sql: "WHERE 1=1", params: [] };
}
