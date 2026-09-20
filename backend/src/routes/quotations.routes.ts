import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/quotations.controller";
import { memberMiddleware } from "../middleware/auth";

const router = Router();
router.post("/", memberMiddleware, asyncHandler(c.create));
router.patch("/:id/status", memberMiddleware, asyncHandler(c.updateStatus));
router.delete("/:id", memberMiddleware, asyncHandler(c.remove));

export default router;
