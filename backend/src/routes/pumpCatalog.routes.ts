import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/pumpCatalog.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.get("/", asyncHandler(c.list));
router.post("/", authMiddleware, asyncHandler(c.create));
router.put("/:id", authMiddleware, asyncHandler(c.update));
router.delete("/:id", authMiddleware, asyncHandler(c.remove));

export default router;

