import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/quotations.controller";
import { adminMiddleware, authMiddleware } from "../middleware/auth";

const router = Router();
router.post("/", authMiddleware, asyncHandler(c.create));
router.patch("/:id/status", adminMiddleware, asyncHandler(c.updateStatus));
router.delete("/:id", adminMiddleware, asyncHandler(c.remove));

export default router;
