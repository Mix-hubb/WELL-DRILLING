import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/customers.controller";

const router = Router();
router.get("/", asyncHandler(c.list));
router.post("/", asyncHandler(c.create));
router.put("/:id", asyncHandler(c.update));
router.delete("/:id", asyncHandler(c.remove));

export default router;
