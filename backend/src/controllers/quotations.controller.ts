import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { Quotation } from "../types";
import { sendTextToCustomer } from "../services/line";

export async function create(req: Request, res: Response) {
  const { kind, drilling_request_id, repair_request_id, price, notes } = req.body;

  if (!["DRILLING", "REPAIR"].includes(kind)) {
    return res.status(400).json({ error: "kind ต้องเป็น DRILLING หรือ REPAIR" });
  }
  if (kind === "DRILLING" && !drilling_request_id) {
    return res.status(400).json({ error: "ต้องระบุ drilling_request_id" });
  }
  if (kind === "REPAIR" && !repair_request_id) {
    return res.status(400).json({ error: "ต้องระบุ repair_request_id" });
  }
  if (price == null || Number(price) <= 0) {
    return res.status(400).json({ error: "ต้องระบุราคาที่มากกว่า 0" });
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO quotations (kind, drilling_request_id, repair_request_id, price, notes)
     VALUES (?, ?, ?, ?, ?)`,
    [kind, kind === "DRILLING" ? drilling_request_id : null, kind === "REPAIR" ? repair_request_id : null, price, notes || null]
  );

  const table = kind === "DRILLING" ? "drilling_requests" : "repair_requests";
  const column = kind === "DRILLING" ? "request_id" : "repair_id";
  await pool.query(
    `UPDATE ${table} SET status = 'QUOTED' WHERE ${column} = ?`,
    [kind === "DRILLING" ? drilling_request_id : repair_request_id]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM quotations WHERE quotation_id = ?", [result.insertId]
  );
  const quotation = rows[0];

  const [custRows] = await pool.query<RowDataPacket[]>(
    `SELECT c.customer_id FROM ${table} r JOIN customers c ON c.customer_id = r.customer_id
     WHERE r.${column} = ?`,
    [kind === "DRILLING" ? drilling_request_id : repair_request_id]
  );
  if (custRows.length) {
    const label = kind === "DRILLING" ? "การขุดเจาะบ่อบาดาล" : "งานซ่อมบ่อบาดาล";
    const msg =
      `ใบเสนอราคา${label}\n` +
      `ราคา ${Number(price).toLocaleString("th-TH")} บาท\n` +
      (notes ? `รายละเอียด: ${notes}\n` : "") +
      "กรุณาแจ้งยืนยันเพื่อดำเนินการต่อ";
    sendTextToCustomer(custRows[0].customer_id, msg, "QUOTE").catch(() => {});
  }

  res.status(201).json(quotation as Quotation);
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  const valid = ["PENDING", "ACCEPTED", "REJECTED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `สถานะไม่ถูกต้อง ต้องเป็น ${valid.join(", ")}` });
  }

  await pool.query("UPDATE quotations SET status = ? WHERE quotation_id = ?", [status, id]);

  if (status === "ACCEPTED") {
    const [quotes] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM quotations WHERE quotation_id = ?", [id]
    );
    const q = quotes[0];
    if (q?.kind === "DRILLING" && q.drilling_request_id) {
      await pool.query("UPDATE drilling_requests SET status = 'ACCEPTED' WHERE request_id = ?", [q.drilling_request_id]);
    }
    if (q?.kind === "REPAIR" && q.repair_request_id) {
      await pool.query("UPDATE repair_requests SET status = 'ACCEPTED' WHERE repair_id = ?", [q.repair_request_id]);
    }
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM quotations WHERE quotation_id = ?", [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบใบเสนอราคา" });
  res.json(rows[0]);
}

export async function remove(req: Request, res: Response) {
  await pool.query("DELETE FROM quotations WHERE quotation_id = ?", [req.params.id]);
  res.status(204).end();
}
