import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/quotations.controller";
import { adminMiddleware } from "../middleware/auth";

const router = Router();
router.post("/", adminMiddleware, asyncHandler(c.create));
router.patch("/:id/status", adminMiddleware, asyncHandler(c.updateStatus));
router.delete("/:id", adminMiddleware, asyncHandler(c.remove));

export default router;
