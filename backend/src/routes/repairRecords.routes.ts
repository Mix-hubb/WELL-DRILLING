import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/repairRecords.controller";
import { adminMiddleware } from "../middleware/auth";

const router = Router();
router.get("/", asyncHandler(c.list));
router.get("/:id", asyncHandler(c.getOne));
router.put("/:id", adminMiddleware, asyncHandler(c.update));
router.delete("/:id", adminMiddleware, asyncHandler(c.remove));

export default router;

