import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/wells.controller";
import { memberMiddleware } from "../middleware/auth";

const router = Router();
router.get("/", asyncHandler(c.list));
router.get("/by-job/:jobId", asyncHandler(c.getByJob));
router.get("/:id/report.pdf", asyncHandler(c.exportReport));
router.get("/:id", asyncHandler(c.getOne));
router.post("/", memberMiddleware, asyncHandler(c.create));
router.delete("/:id", memberMiddleware, asyncHandler(c.remove));

router.post("/:wellId/strata", memberMiddleware, asyncHandler(c.addStrata));
router.delete("/:wellId/strata/:strataId", memberMiddleware, asyncHandler(c.removeStrata));

router.post("/:wellId/pipes", memberMiddleware, asyncHandler(c.addPipe));
router.delete("/:wellId/pipes/:pipeId", memberMiddleware, asyncHandler(c.removePipe));

router.post("/:wellId/pumps", memberMiddleware, asyncHandler(c.addPump));
router.delete("/:wellId/pumps/:pumpId", memberMiddleware, asyncHandler(c.removePump));

router.post("/:wellId/control-boxes", memberMiddleware, asyncHandler(c.addControlBox));
router.delete("/:wellId/control-boxes/:controlBoxId", memberMiddleware, asyncHandler(c.removeControlBox));

export default router;
