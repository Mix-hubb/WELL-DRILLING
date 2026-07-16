import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/wells.controller";

const router = Router();
router.get("/lithology-types", asyncHandler(c.getLithologyTypes));
router.get("/", asyncHandler(c.list));
router.get("/by-job/:jobId", asyncHandler(c.getByJob));
router.get("/:id/report.pdf", asyncHandler(c.exportReport));
router.get("/:id", asyncHandler(c.getOne));
router.post("/", asyncHandler(c.create));

router.post("/:wellId/strata", asyncHandler(c.addStrata));
router.delete("/:wellId/strata/:strataId", asyncHandler(c.removeStrata));

router.post("/:wellId/pipes", asyncHandler(c.addPipe));
router.delete("/:wellId/pipes/:pipeId", asyncHandler(c.removePipe));

router.post("/:wellId/pumps", asyncHandler(c.addPump));
router.delete("/:wellId/pumps/:pumpId", asyncHandler(c.removePump));

export default router;
