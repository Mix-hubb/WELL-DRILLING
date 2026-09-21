import rateLimit from "express-rate-limit";

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});

export const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

// LINE ส่ง webhook มาจาก IP ของแพลตฟอร์ม LINE เอง ซึ่งใช้ร่วมกันได้หลายองค์กรบนระบบนี้
// (multi-tenant) จำกัดแบบ publicLimiter (20 req/min ต่อ IP) เสี่ยงทำให้ LINE ส่งข้อความ/
// postback ของลูกค้าองค์กรอื่นไม่ผ่านเมื่อทราฟฟิกรวมสูง จึงต้องแยก limiter ที่ผ่อนปรนกว่า
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
