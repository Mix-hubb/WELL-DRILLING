import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock("../config/db", () => ({
  pool: { query: mocks.poolQuery },
}));
vi.mock("../services/sse", () => ({ broadcast: mocks.broadcast }));

import * as pumpCatalog from "./pumpCatalog.controller";

function createRes() {
  const res: any = { statusCode: 200 };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn();
  return res as Response & { statusCode: number; json: any; status: any; end: any };
}

describe("pumpCatalog.controller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("list", () => {
    it("should list active models by default", async () => {
      mocks.poolQuery.mockResolvedValueOnce({
        rows: [
          {
            model_id: 1,
            brand: "FRANKLIN",
            series: "FPS 4400",
            model: "10FPS05S4-2W230",
            reference_price: "18500",
            is_active: true,
          },
        ],
      });

      const req = { query: {} } as unknown as Request;
      const res = createRes();

      await pumpCatalog.list(req, res);

      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({
          model_id: 1,
          brand: "FRANKLIN",
          reference_price: 18500,
        }),
      ]);
    });
  });

  describe("create", () => {
    it("should return 400 if brand or model is missing", async () => {
      const req = { body: { brand: "FRANKLIN" } } as Request;
      const res = createRes();

      await pumpCatalog.create(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("should create model successfully", async () => {
      const req = {
        body: {
          brand: "TORISHIMA",
          model: "SP-100",
          motor_power: "2 HP",
          reference_price: "25000",
        },
      } as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({
        rows: [{ model_id: 2, brand: "TORISHIMA", model: "SP-100" }],
      });

      await pumpCatalog.create(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ model_id: 2 }));
      expect(mocks.broadcast).toHaveBeenCalledWith({
        type: "PUMP_CATALOG_CREATED",
        data: { model_id: 2, brand: "TORISHIMA", model: "SP-100" },
      });
    });
  });

  describe("update", () => {
    it("should return 404 if model does not exist", async () => {
      const req = {
        params: { id: "999" },
        body: { brand: "TORISHIMA", model: "SP-100" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({ rows: [] });

      await pumpCatalog.update(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should update model successfully", async () => {
      const req = {
        params: { id: "2" },
        body: { brand: "TORISHIMA", model: "SP-200" },
      } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({
        rows: [{ model_id: 2, brand: "TORISHIMA", model: "SP-200" }],
      });

      await pumpCatalog.update(req, res);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ model: "SP-200" }));
      expect(mocks.broadcast).toHaveBeenCalledWith({
        type: "PUMP_CATALOG_UPDATED",
        data: { model_id: 2, brand: "TORISHIMA", model: "SP-200" },
      });
    });
  });

  describe("remove", () => {
    it("should return 404 if model does not exist", async () => {
      const req = { params: { id: "999" } } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({ rowCount: 0 });

      await pumpCatalog.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("should delete model and return 204", async () => {
      const req = { params: { id: "2" } } as unknown as Request;
      const res = createRes();

      mocks.poolQuery.mockResolvedValueOnce({ rowCount: 1 });

      await pumpCatalog.remove(req, res);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(mocks.broadcast).toHaveBeenCalledWith({
        type: "PUMP_CATALOG_DELETED",
        data: { model_id: 2 },
      });
    });
  });
});
