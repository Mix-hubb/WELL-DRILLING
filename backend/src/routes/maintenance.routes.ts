import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/maintenance.controller";

const router = Router();

router.get("/event-types",      asyncHandler(c.listEventTypes));
router.get("/overdue",          asyncHandler(c.listOverdue));
router.get("/well/:wellId",     asyncHandler(c.listByWell));
router.post("/well/:wellId",    asyncHandler(c.create));
router.delete("/:id",           asyncHandler(c.remove));

export default router;
