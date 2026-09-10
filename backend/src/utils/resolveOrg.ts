export async function resolveOrgId(client: any, liffId?: string, explicitOrgId?: string): Promise<string | null> {
  if (explicitOrgId) return explicitOrgId;
  if (!liffId) return null;
  const { rows } = await client.query(
    "SELECT org_id FROM organizations WHERE line_liff_id_drilling = $1 OR line_liff_id_repair = $1 ORDER BY created_at ASC LIMIT 1",
    [liffId]
  );
  return rows[0]?.org_id || null;
}
