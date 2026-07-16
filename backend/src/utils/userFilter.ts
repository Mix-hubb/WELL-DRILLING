import { Request } from "express";

export function userFilter(req: Request, alias = "c"): { sql: string; params: any[] } {
  if (req.user!.role === "ADMIN") return { sql: "", params: [] };
  return { sql: ` AND ${alias}.user_id = ?`, params: [req.user!.userId] };
}

export function userWhere(req: Request, alias = "c"): { sql: string; params: any[] } {
  if (req.user!.role === "ADMIN") return { sql: "WHERE 1=1", params: [] };
  return { sql: `WHERE ${alias}.user_id = ?`, params: [req.user!.userId] };
}
