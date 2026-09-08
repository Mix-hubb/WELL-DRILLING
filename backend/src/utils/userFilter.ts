import { Request } from "express";

export function userFilter(_req: Request, _alias = "c"): { sql: string; params: any[] } {
  const orgId = _req.user?.orgId;
  if (!orgId) return { sql: "", params: [] };
  const paramIdx = _sqlParamIndex(_req);
  return { sql: ` AND ${_alias}.org_id = $${paramIdx}`, params: [orgId] };
}

export function userWhere(_req: Request, _alias = "c"): { sql: string; params: any[] } {
  const orgId = _req.user?.orgId;
  if (!orgId) return { sql: "WHERE 1=1", params: [] };
  const paramIdx = _sqlParamIndex(_req);
  return { sql: `WHERE ${_alias}.org_id = $${paramIdx}`, params: [orgId] };
}

function _sqlParamIndex(_req: Request): number {
  return 1;
}
