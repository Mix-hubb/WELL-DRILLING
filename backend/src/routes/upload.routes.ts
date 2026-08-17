import { Router } from "express";
import { upload, magicAuth } from "../middleware/upload";
import { authMiddleware } from "../middleware/auth";

const router = Router();

function fileUrl(req: any, res: any) {
  if (!req.file) return res.status(400).json({ error: "ไม่พบไฟล์ที่อัปโหลด" });
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
}

router.post("/", authMiddleware, upload.single("file"), fileUrl);
router.post("/public", magicAuth, upload.single("file"), fileUrl);
router.post("/form", upload.single("file"), fileUrl);

export default router;
