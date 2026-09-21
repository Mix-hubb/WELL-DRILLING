import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/org.controller";
import { adminMiddleware } from "../middleware/auth";

// authMiddleware ถูกใส่ไว้แล้วตอน mount "/api/org" ใน server.ts — ไม่ต้องใส่ซ้ำที่นี่
const router = Router();

router.get("/info", asyncHandler(c.getOrgInfo));
router.get("/members", asyncHandler(c.getMembers));
router.post("/invite-code/rotate", adminMiddleware, asyncHandler(c.rotateInviteCode));
router.post("/invite-code", adminMiddleware, asyncHandler(c.updateInviteCode));
router.patch("/members/:id/role", adminMiddleware, asyncHandler(c.updateMemberRole));
router.delete("/members/:id", adminMiddleware, asyncHandler(c.removeMember));

export default router;
