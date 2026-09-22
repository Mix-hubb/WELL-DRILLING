import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/customers.controller";
import { adminMiddleware } from "../middleware/auth";

const router = Router();
router.get("/", asyncHandler(c.list));
router.get("/:id/overview", asyncHandler(c.getOverview));
router.get("/:id", asyncHandler(c.getOne));
router.post("/", adminMiddleware, asyncHandler(c.create));
router.put("/:id", adminMiddleware, asyncHandler(c.update));
router.delete("/:id", adminMiddleware, asyncHandler(c.remove));

export default router;
