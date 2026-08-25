import crypto from "crypto";
import bcrypt from "bcryptjs";

const CODE_LENGTH = 6;
const CODE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

export function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10);
}

export async function verifyCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}

export function isCodeExpired(expiresAt: Date): boolean {
  return Date.now() > expiresAt.getTime();
}

export function getCodeExpiry(): Date {
  return new Date(Date.now() + CODE_EXPIRY_MS);
}
