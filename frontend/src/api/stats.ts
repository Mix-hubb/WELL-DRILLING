import { api } from "./client";
import type { StatsOverview } from "@/types";

export const statsApi = {
  overview: () => api.get<StatsOverview>("/stats/overview"),
};
