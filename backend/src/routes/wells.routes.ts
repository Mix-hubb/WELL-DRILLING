import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/wells.controller";
import { adminMiddleware } from "../middleware/auth";

const router = Router();
router.get("/", asyncHandler(c.list));
router.get("/by-job/:jobId", asyncHandler(c.getByJob));
router.get("/:id/report.pdf", asyncHandler(c.exportReport));
router.get("/:id", asyncHandler(c.getOne));
router.post("/", adminMiddleware, asyncHandler(c.create));
router.delete("/:id", adminMiddleware, asyncHandler(c.remove));

router.post("/:wellId/strata", adminMiddleware, asyncHandler(c.addStrata));
router.delete("/:wellId/strata/:strataId", adminMiddleware, asyncHandler(c.removeStrata));

router.post("/:wellId/pipes", adminMiddleware, asyncHandler(c.addPipe));
router.delete("/:wellId/pipes/:pipeId", adminMiddleware, asyncHandler(c.removePipe));

router.post("/:wellId/pumps", adminMiddleware, asyncHandler(c.addPump));
router.delete("/:wellId/pumps/:pumpId", adminMiddleware, asyncHandler(c.removePump));

router.post("/:wellId/control-boxes", adminMiddleware, asyncHandler(c.addControlBox));
router.delete("/:wellId/control-boxes/:controlBoxId", adminMiddleware, asyncHandler(c.removeControlBox));

export default router;
