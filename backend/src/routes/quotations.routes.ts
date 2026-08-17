import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/quotations.controller";

const router = Router();
router.post("/", asyncHandler(c.create));
router.patch("/:id/status", asyncHandler(c.updateStatus));
router.delete("/:id", asyncHandler(c.remove));

export default router;
