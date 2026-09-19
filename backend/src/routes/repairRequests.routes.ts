import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/repairRequests.controller";
import { adminMiddleware } from "../middleware/auth";

const router = Router();
router.get("/", asyncHandler(c.list));
router.get("/:id", asyncHandler(c.getOne));
router.post("/", adminMiddleware, asyncHandler(c.create));
router.put("/:id", adminMiddleware, asyncHandler(c.update));
router.patch("/:id/status", adminMiddleware, asyncHandler(c.updateStatus));
router.post("/:id/magic-link", adminMiddleware, asyncHandler(c.generateMagicLink));
router.delete("/:id", adminMiddleware, asyncHandler(c.remove));
// Payment slips — ดูและยืนยันสลิปโอนเงินของลูกค้า
router.get("/:id/payment-slips", asyncHandler(c.listPaymentSlips));
router.patch("/:id/payment-slips/:slipId", adminMiddleware, asyncHandler(c.verifyPaymentSlip));
router.get("/:id/receipt.pdf", asyncHandler(c.exportReceipt));
router.post("/:id/send-receipt", adminMiddleware, asyncHandler(c.sendReceiptToCustomer));

export default router;
