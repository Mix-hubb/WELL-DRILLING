import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/customers.controller";
import { memberMiddleware } from "../middleware/auth";

const router = Router();
router.get("/", asyncHandler(c.list));
router.get("/:id/overview", asyncHandler(c.getOverview));
router.get("/:id", asyncHandler(c.getOne));
router.post("/", memberMiddleware, asyncHandler(c.create));
router.put("/:id", memberMiddleware, asyncHandler(c.update));
router.delete("/:id", memberMiddleware, asyncHandler(c.remove));

export default router;
