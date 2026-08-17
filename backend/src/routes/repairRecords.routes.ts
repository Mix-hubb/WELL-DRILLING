import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/repairRecords.controller";

const router = Router();
router.get("/", asyncHandler(c.list));
router.get("/:id", asyncHandler(c.getOne));
router.delete("/:id", asyncHandler(c.remove));

export default router;
