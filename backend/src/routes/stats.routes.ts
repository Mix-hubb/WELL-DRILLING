import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/stats.controller";

const router = Router();
router.get("/overview", asyncHandler(c.overview));

export default router;
