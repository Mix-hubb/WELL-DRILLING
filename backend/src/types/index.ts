export type JobStatus = "PENDING" | "DRILLING" | "COMPLETED";

export type StrataType =
  | "BANGKOK_CLAY" | "SILTY_SAND" | "GRAVEL" | "SANDSTONE"
  | "MAHA_SARAKHAM_SALT" | "SHALE" | "LIMESTONE" | "GRANITE" | "OTHER";

export type PipeType = "CASING_PVC" | "SCREEN_PVC" | "CASING_STEEL" | "SCREEN_STEEL";
export type PipeSize = "4_INCH" | "5_INCH" | "6_INCH" | "8_INCH";
export type ThicknessClass = "CLASS_8.5" | "CLASS_13.5" | "STEEL_STANDARD" | "NONE";
export type PumpType = "AC_SUBMERSIBLE" | "DC_SOLAR_SUBMERSIBLE" | "OTHER";

export interface Driller {
  driller_id: number;
  team_name: string;
  leader_name: string;
  phone: string;
  created_at?: string;
}

export interface Customer {
  customer_id: number;
  customer_name: string;
  phone: string;
  address?: string;
  created_at?: string;
}

export interface DrillingJob {
  job_id: number;
  driller_id: number;
  customer_id: number;
  job_title: string;
  site_address: string;
  latitude: number;
  longitude: number;
  scheduled_date: string;
  status: JobStatus;
  estimated_price: number;
  final_price: number;
  created_at?: string;
  updated_at?: string;
}

export interface WellLog {
  well_id: number;
  job_id: number;
  total_depth: number;
  water_quantity: number;
  static_water_level: number;
  pumping_water_level: number;
  completion_date: string;
  notes?: string;
}

export interface WellStrataLog {
  strata_id: number;
  well_id: number;
  depth_from: number;
  depth_to: number;
  strata_type: StrataType;
  description?: string;
}

export interface WellPipe {
  pipe_id: number;
  well_id: number;
  depth_from: number;
  depth_to: number;
  pipe_type: PipeType;
  pipe_size: PipeSize;
  thickness_class: ThicknessClass;
}

export interface WellPump {
  pump_id: number;
  well_id: number;
  pump_type: PumpType;
  brand?: string;
  horsepower: number;
  impeller_stages?: number;
  installation_depth: number;
  installed_date: string;
}

export interface FullWell extends WellLog {
  strata: WellStrataLog[];
  pipes: WellPipe[];
  pumps: WellPump[];
}
