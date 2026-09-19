import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/pumpCatalog.controller";
import { adminMiddleware, authMiddleware } from "../middleware/auth";

const router = Router();
router.get("/", asyncHandler(c.list));
router.post("/", authMiddleware, adminMiddleware, asyncHandler(c.create));
router.put("/:id", authMiddleware, adminMiddleware, asyncHandler(c.update));
router.delete("/:id", authMiddleware, adminMiddleware, asyncHandler(c.remove));

export default router;

