import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/org.controller";
import { adminMiddleware, authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

router.get("/info", asyncHandler(c.getOrgInfo));
router.get("/members", asyncHandler(c.getMembers));
router.post("/invite-code/rotate", adminMiddleware, asyncHandler(c.rotateInviteCode));
router.post("/invite-code", adminMiddleware, asyncHandler(c.updateInviteCode));
router.patch("/members/:id/role", adminMiddleware, asyncHandler(c.updateMemberRole));
router.delete("/members/:id", adminMiddleware, asyncHandler(c.removeMember));

export default router;
