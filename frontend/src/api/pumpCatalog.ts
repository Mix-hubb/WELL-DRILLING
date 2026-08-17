import { api } from "./client";
import type { PumpCatalogModel } from "@/types";

export const pumpCatalogApi = {
  list: (brand?: string) =>
    api.get<PumpCatalogModel[]>(brand ? `/pump-catalog?brand=${encodeURIComponent(brand)}` : "/pump-catalog"),
};
