import { Request } from "express";

export function userFilter(_req: Request, _alias = "c", _existingParamCount = 0): { sql: string; params: any[] } {
  const orgId = _req.user?.orgId;
  if (!orgId) return { sql: "", params: [] };
  const paramIdx = _existingParamCount + 1;
  return { sql: ` AND ${_alias}.org_id = $${paramIdx}`, params: [orgId] };
}

export function userWhere(_req: Request, _alias = "c", _existingParamCount = 0): { sql: string; params: any[] } {
  const orgId = _req.user?.orgId;
  if (!orgId) return { sql: "WHERE 1=1", params: [] };
  const paramIdx = _existingParamCount + 1;
  return { sql: `WHERE ${_alias}.org_id = $${paramIdx}`, params: [orgId] };
}
