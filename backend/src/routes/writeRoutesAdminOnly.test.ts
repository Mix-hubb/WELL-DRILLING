import { describe, it, expect, vi } from "vitest";

// เมาต์ dependency ทั้งหมดที่ route/controller ต้องใช้ตอน import เป็น mock เปล่าๆ
// เพราะเทสต์นี้สนใจแค่การเดินสาย middleware ของ router ไม่ได้เรียก DB จริง
vi.mock("../config/db", () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock("../services/sse", () => ({ broadcast: vi.fn() }));
vi.mock("../services/line", () => ({
  sendTextToCustomer: vi.fn(),
  sendFlexToCustomer: vi.fn(),
  buildLineNoticeFlex: vi.fn(),
  buildRepairReceiptFlex: vi.fn(),
  sendTextToCustomerById: vi.fn(),
}));
vi.mock("../utils/pdfReport", () => ({ streamWellReportPdf: vi.fn() }));
vi.mock("../utils/pdfReceipt", () => ({ streamRepairReceiptPdf: vi.fn() }));

import { adminMiddleware } from "../middleware/auth";
import customersRouter from "./customers.routes";
import wellsRouter from "./wells.routes";
import jobsRouter from "./jobs.routes";
import drillingRequestsRouter from "./drillingRequests.routes";
import repairRequestsRouter from "./repairRequests.routes";
import repairRecordsRouter from "./repairRecords.routes";
import quotationsRouter from "./quotations.routes";

/**
 * ดึงรายการ { method, path, handlers } ของทุก route ที่ประกาศไว้ใน Express Router
 * โดยอ่านจาก router.stack ตรงๆ (ไม่ยิง HTTP จริง) เพื่อตรวจว่า route ที่ไม่ใช่ GET/HEAD
 * ทุกตัวต้องมี adminMiddleware อยู่ในสาย handler จริงๆ ไม่ใช่แค่ import มาเฉยๆ
 */
function listRoutes(router: any): Array<{ method: string; path: string; handlers: Function[] }> {
  const routes: Array<{ method: string; path: string; handlers: Function[] }> = [];
  for (const layer of router.stack) {
    if (!layer.route) continue;
    const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]);
    const handlers = layer.route.stack.map((s: any) => s.handle);
    for (const method of methods) {
      routes.push({ method: method.toUpperCase(), path: layer.route.path, handlers });
    }
  }
  return routes;
}

const routers: Array<[string, any]> = [
  ["customers.routes", customersRouter],
  ["wells.routes", wellsRouter],
  ["jobs.routes", jobsRouter],
  ["drillingRequests.routes", drillingRequestsRouter],
  ["repairRequests.routes", repairRequestsRouter],
  ["repairRecords.routes", repairRecordsRouter],
  ["quotations.routes", quotationsRouter],
];

describe("every write route (POST/PUT/PATCH/DELETE) requires adminMiddleware", () => {
  for (const [name, router] of routers) {
    const routes = listRoutes(router);
    const writeRoutes = routes.filter((r) => r.method !== "GET" && r.method !== "HEAD");

    it(`${name} has at least one write route to check`, () => {
      expect(writeRoutes.length).toBeGreaterThan(0);
    });

    for (const route of writeRoutes) {
      it(`${name} ${route.method} ${route.path} is gated by adminMiddleware`, () => {
        expect(route.handlers).toContain(adminMiddleware);
      });
    }
  }

  it("GET routes are never gated by adminMiddleware (drillers must still be able to view)", () => {
    for (const [, router] of routers) {
      const getRoutes = listRoutes(router).filter((r) => r.method === "GET");
      for (const route of getRoutes) {
        expect(route.handlers).not.toContain(adminMiddleware);
      }
    }
  });
});
