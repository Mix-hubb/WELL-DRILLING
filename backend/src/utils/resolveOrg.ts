export type LiffFormType = "drilling" | "repair";

export async function resolveOrgId(client: any, liffId: string | undefined, formType: LiffFormType): Promise<string | null> {
  if (!liffId) return null;
  const column = formType === "drilling" ? "line_liff_id_drilling" : "line_liff_id_repair";
  const { rows } = await client.query(
    `SELECT org_id FROM organizations WHERE ${column} = $1 LIMIT 1`,
    [liffId]
  );
  return rows[0]?.org_id || null;
}
