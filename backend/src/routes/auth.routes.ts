import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as a from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth";

const router = Router();
router.post("/register", asyncHandler(a.register));
router.post("/login", asyncHandler(a.login));
router.get("/me", authMiddleware, asyncHandler(a.me));
router.post("/forgot-password", asyncHandler(a.forgotPassword));
router.post("/verify-code", asyncHandler(a.verifyCodeHandler));
router.post("/reset-password", asyncHandler(a.resetPassword));

export default router;
