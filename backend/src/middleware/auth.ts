import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "welldrill-dev-secret-change-me";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be configured in production");
}

export interface AuthPayload {
  userId: string;
  email: string;
  role: "ADMIN" | "DRILLER";
  orgId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "ไม่ได้เข้าสู่ระบบ" });
  }
  try {
    const payload = verifyToken(header.slice(7));
    if (!payload.userId || !payload.email || !payload.orgId || !["ADMIN", "DRILLER"].includes(payload.role)) {
      return res.status(401).json({ error: "Token ไม่ถูกต้อง" });
    }
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่" });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "ไม่มีสิทธิ์เข้าถึง" });
  }
  next();
}

export function memberMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.userId || !req.user.orgId) {
    return res.status(403).json({ error: "ผู้ใช้ไม่ได้สังกัดองค์กร" });
  }
  next();
}
