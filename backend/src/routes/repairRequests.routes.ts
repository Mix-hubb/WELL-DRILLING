import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/repairRequests.controller";
import { memberMiddleware } from "../middleware/auth";
import { upload } from "../middleware/upload";

const router = Router();
router.get("/", asyncHandler(c.list));
router.get("/:id", asyncHandler(c.getOne));
router.post("/", memberMiddleware, asyncHandler(c.create));
router.put("/:id", memberMiddleware, asyncHandler(c.update));
router.patch("/:id/status", memberMiddleware, asyncHandler(c.updateStatus));
router.post("/:id/magic-link", memberMiddleware, asyncHandler(c.generateMagicLink));
router.delete("/:id", memberMiddleware, asyncHandler(c.remove));
// Payment slips — ดู สร้าง และยืนยันสลิปโอนเงินของลูกค้า
router.get("/:id/payment-slips", asyncHandler(c.listPaymentSlips));
router.post("/:id/payment-slips", memberMiddleware, upload.single("file"), asyncHandler(c.createPaymentSlip));
router.patch("/:id/payment-slips/:slipId", memberMiddleware, asyncHandler(c.verifyPaymentSlip));
router.get("/:id/receipt.pdf", asyncHandler(c.exportReceipt));
router.post("/:id/send-receipt", memberMiddleware, asyncHandler(c.sendReceiptToCustomer));

export default router;
