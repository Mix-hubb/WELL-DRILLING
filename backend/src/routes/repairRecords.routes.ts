import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/repairRecords.controller";
import { memberMiddleware } from "../middleware/auth";

const router = Router();
router.get("/", asyncHandler(c.list));
router.get("/:id", asyncHandler(c.getOne));
router.put("/:id", memberMiddleware, asyncHandler(c.update));
router.delete("/:id", memberMiddleware, asyncHandler(c.remove));

export default router;

