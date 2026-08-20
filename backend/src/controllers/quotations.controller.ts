import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { Quotation } from "../types";
import { sendTextToCustomer, sendFlexToCustomer } from "../services/line";

function buildDrillingQuoteFlex(price: number, notes: string | null, requestId: number, depthM?: number | null, diameterM?: number | null) {
  const priceStr = Number(price).toLocaleString("th-TH");
  const detailLines = notes ? notes.split("\n").slice(0, 5).join("\n") : null;
  const bodyContents: any[] = [
    { type: "text", text: `ราคาประเมิน`, size: "sm", color: "#999999" },
    { type: "text", text: `${priceStr} บาท`, weight: "bold", size: "xl", color: "#1B5E20" },
  ];
  if (depthM) {
    bodyContents.push({ type: "separator", margin: "lg" });
    bodyContents.push({ type: "text", text: "รายละเอียดงาน", size: "sm", color: "#999999", margin: "md" });
    bodyContents.push({ type: "text", text: `ความลึกที่ต้องการขุด: ${depthM} ม.`, size: "sm", wrap: true });
  }
  if (diameterM) {
    bodyContents.push({ type: "text", text: `ขนาดหน้าแปลนขุดเจาะ: ${diameterM} ม.`, size: "sm", wrap: true });
  }
  if (detailLines) {
    if (!depthM && !diameterM) {
      bodyContents.push({ type: "separator", margin: "lg" });
      bodyContents.push({ type: "text", text: "รายละเอียดงาน", size: "sm", color: "#999999", margin: "md" });
    }
    bodyContents.push({ type: "text", text: detailLines, size: "sm", wrap: true });
  }
  return {
    type: "bubble",
    size: "giga",
    header: {
      type: "box", layout: "vertical",
      backgroundColor: "#1B5E20",
      contents: [{ type: "text", text: "ใบเสนอราคาขุดเจาะบ่อบาดาล", weight: "bold", color: "#FFFFFF", size: "lg" }],
    },
    body: {
      type: "box", layout: "vertical", spacing: "md",
      contents: bodyContents,
    },
    footer: {
      type: "box", layout: "horizontal", spacing: "md",
      contents: [
        {
          type: "button", style: "secondary", color: "#DD2C00", height: "sm",
          action: { type: "postback", label: "ปฏิเสธ", data: `reject_drill_${requestId}` },
        },
        {
          type: "button", style: "primary", color: "#1B5E20", height: "sm",
          action: { type: "postback", label: "ยอมรับ", data: `accept_drill_${requestId}` },
        },
      ],
    },
  };
}

function buildRepairQuoteFlex(price: number, notes: string | null, repairId: number) {
  const priceStr = Number(price).toLocaleString("th-TH");
  const detailLines = notes ? notes.split("\n").slice(0, 5).join("\n") : "—";
  return {
    type: "bubble",
    size: "giga",
    header: {
      type: "box", layout: "vertical",
      backgroundColor: "#0D47A1",
      contents: [{ type: "text", text: "ใบเสนอราคางานซ่อมบ่อบาดาล", weight: "bold", color: "#FFFFFF", size: "lg" }],
    },
    body: {
      type: "box", layout: "vertical", spacing: "md",
      contents: [
        { type: "text", text: "ราคาประเมิน", size: "sm", color: "#999999" },
        { type: "text", text: `${priceStr} บาท`, weight: "bold", size: "xl", color: "#0D47A1" },
        ...(notes ? [
          { type: "separator", margin: "lg" },
          { type: "text", text: "รายละเอียดงาน / อุปกรณ์ที่ต้องเปลี่ยน", size: "sm", color: "#999999", margin: "md" },
          { type: "text", text: detailLines, size: "sm", wrap: true },
        ] : []),
      ],
    },
    footer: {
      type: "box", layout: "horizontal", spacing: "md",
      contents: [
        {
          type: "button", style: "secondary", color: "#DD2C00", height: "sm",
          action: { type: "postback", label: "ปฏิเสธ", data: `reject_repair_${repairId}` },
        },
        {
          type: "button", style: "primary", color: "#0D47A1", height: "sm",
          action: { type: "postback", label: "ยอมรับ", data: `accept_repair_${repairId}` },
        },
      ],
    },
  };
}

export async function create(req: Request, res: Response) {
  const { kind, drilling_request_id, repair_request_id, price, notes, requested_depth_m, requested_diameter_m } = req.body;

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
    `INSERT INTO quotations (kind, drilling_request_id, repair_request_id, requested_depth_m, requested_diameter_m, price, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      kind,
      kind === "DRILLING" ? drilling_request_id : null,
      kind === "REPAIR" ? repair_request_id : null,
      requested_depth_m || null,
      requested_diameter_m || null,
      price,
      notes || null,
    ]
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
    if (kind === "DRILLING") {
      const flex = buildDrillingQuoteFlex(price, notes, drilling_request_id, requested_depth_m, requested_diameter_m);
      const label = `ใบเสนอราคาขุดเจาะ ราคา ${Number(price).toLocaleString("th-TH")} บาท`;
      sendFlexToCustomer(custRows[0].customer_id, label, flex, "QUOTE").catch(() => {});
    } else {
      const flex = buildRepairQuoteFlex(price, notes, repair_request_id);
      const label = `ใบเสนอราคางานซ่อม ราคา ${Number(price).toLocaleString("th-TH")} บาท`;
      sendFlexToCustomer(custRows[0].customer_id, label, flex, "QUOTE").catch(() => {});
    }
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
