import { randomInt } from "crypto";

const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

type QueryFn = (sql: string, params: unknown[]) => Promise<{ rows: unknown[] }>;

export function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CHARSET[randomInt(CHARSET.length)];
  }
  return code;
}

export async function createUniqueInviteCode(query: QueryFn, attempts = 10): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const code = generateInviteCode();
    const { rows } = await query(
      "SELECT 1 FROM organizations WHERE LOWER(invite_code) = LOWER($1)",
      [code]
    );
    if (!rows.length) return code;
  }
  throw new Error("ไม่สามารถสร้างรหัสเชิญได้ กรุณาลองใหม่อีกครั้ง");
}