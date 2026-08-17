import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/pumpCatalog.controller";

const router = Router();
router.get("/", asyncHandler(c.list));

export default router;
