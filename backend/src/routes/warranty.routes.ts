import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/warranty.controller";

const router = Router();

router.get("/", asyncHandler(c.list));
router.get("/summary", asyncHandler(c.summary));

export default router;
