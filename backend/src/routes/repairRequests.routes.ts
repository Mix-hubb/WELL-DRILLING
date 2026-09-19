import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import * as c from "../controllers/repairRequests.controller";

const router = Router();
router.get("/", asyncHandler(c.list));
router.get("/:id", asyncHandler(c.getOne));
router.post("/", asyncHandler(c.create));
router.put("/:id", asyncHandler(c.update));
router.patch("/:id/status", asyncHandler(c.updateStatus));
router.post("/:id/magic-link", asyncHandler(c.generateMagicLink));
router.delete("/:id", asyncHandler(c.remove));
// Payment slips — ดูและยืนยันสลิปโอนเงินของลูกค้า
router.get("/:id/payment-slips", asyncHandler(c.listPaymentSlips));
router.patch("/:id/payment-slips/:slipId", asyncHandler(c.verifyPaymentSlip));
router.get("/:id/receipt.pdf", asyncHandler(c.exportReceipt));
router.post("/:id/send-receipt", asyncHandler(c.sendReceiptToCustomer));

export default router;
