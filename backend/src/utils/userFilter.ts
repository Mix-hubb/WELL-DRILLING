import { Request } from "express";

// ผู้ประกอบการที่ login แล้วเห็นข้อมูลของระบบร่วมกัน
export function userFilter(_req: Request, _alias = "c"): { sql: string; params: any[] } {
  return { sql: "", params: [] };
}

export function userWhere(_req: Request, _alias = "c"): { sql: string; params: any[] } {
  return { sql: "WHERE 1=1", params: [] };
}
