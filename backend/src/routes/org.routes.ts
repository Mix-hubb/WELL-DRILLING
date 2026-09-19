import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/org.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.use(authMiddleware);

router.get("/info", asyncHandler(c.getOrgInfo));
router.get("/members", asyncHandler(c.getMembers));
router.patch("/members/:id/role", asyncHandler(c.updateMemberRole));
router.delete("/members/:id", asyncHandler(c.removeMember));

export default router;
