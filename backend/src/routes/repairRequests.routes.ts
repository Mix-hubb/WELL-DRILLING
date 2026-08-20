import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/repairRequests.controller";

const router = Router();
router.get("/", asyncHandler(c.list));
router.get("/:id", asyncHandler(c.getOne));
router.post("/", asyncHandler(c.create));
router.put("/:id", asyncHandler(c.update));
router.patch("/:id/status", asyncHandler(c.updateStatus));
router.post("/:id/magic-link", asyncHandler(c.generateMagicLink));
router.delete("/:id", asyncHandler(c.remove));

export default router;
