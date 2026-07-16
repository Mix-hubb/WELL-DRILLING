export type JobStatus    = "PENDING" | "DRILLING" | "COMPLETED" | "ARCHIVED";
export type PipeType     = "CASING_PVC" | "SCREEN_PVC" | "CASING_STEEL" | "SCREEN_STEEL";
export type PipeSize     = "4_INCH" | "5_INCH" | "6_INCH" | "8_INCH";
export type ThicknessClass = "CLASS_8.5" | "CLASS_13.5" | "STEEL_STANDARD" | "NONE";
export type PumpType     = "AC_SUBMERSIBLE" | "DC_SOLAR_SUBMERSIBLE" | "OTHER";
export type WarrantyStatus = "IN_WARRANTY" | "EXPIRED";
export type AlertTier    = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";

// StrataType ยังคงไว้เพื่อ backward compat กับ constants เดิม
export type StrataType =
  | "BANGKOK_CLAY" | "SILTY_SAND" | "GRAVEL" | "SANDSTONE"
  | "MAHA_SARAKHAM_SALT" | "SHALE" | "LIMESTONE" | "GRANITE" | "OTHER";

// ============================================================
export interface Customer {
  customer_id: number;
  customer_name: string;
  phone: string;
  phone_alt?: string;
  address?: string;
  created_at?: string;
}

export interface DrillingJob {
  job_id: number;
  job_reference: string;
  customer_id: number;
  job_title: string;
  site_address: string;
  province: string;
  district: string;
  latitude?: number | null;
  longitude?: number | null;
  scheduled_date: string;
  requested_depth_m: number;
  status: JobStatus;
  priority: "NORMAL" | "HIGH" | "URGENT";
  notes?: string;
  // joined fields
  customer_name?: string;
  customer_phone?: string;
  phone_alt?: string;
  well_id?: number | null;
  warranty_expire_date?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WellStrataLog {
  strata_id: number;
  well_id: number;
  lithology_type_id?: number;
  depth_from: number;
  depth_to: number;
  // เดิม (backward compat)
  strata_type?: StrataType;
  // ใหม่ (joined from lithology_types)
  lithology_name?: string;
  lithology_name_th?: string;
  fill_color?: string;
  svg_pattern?: string;
  color_override?: string | null;
  hardness?: string | null;
  rqd_percent?: number | null;
  is_water_bearing: number;
  conductivity_us?: number | null;
  ph_value?: number | null;
  tds_ppm?: number | null;
  description?: string | null;
}

export interface WellPipe {
  pipe_id: number;
  well_id: number;
  pipe_type_id?: number | null;
  pipe_type: PipeType;
  pipe_size: PipeSize;
  thickness_class: ThicknessClass;
  diameter_mm?: number | null;
  wall_thickness_mm?: number | null;
  depth_from: number;
  depth_to: number;
  quantity: number;
  joint_length_m?: number;
  notes?: string | null;
}

export interface WellPump {
  pump_id: number;
  well_id: number;
  pump_type: PumpType;
  brand?: string | null;
  horsepower: number;
  power_kw?: number | null;
  impeller_stages?: number | null;
  installation_depth: number;
  installed_date: string;
  notes?: string | null;
}

export interface WellLog {
  well_id: number;
  job_id: number;
  total_depth: number;
  casing_depth?: number | null;
  water_quantity: number;
  yield_lpm?: number | null;
  static_water_level: number;
  pumping_water_level: number;
  pump_depth?: number | null;
  pump_power_kw?: number | null;
  pump_brand?: string | null;
  pump_type?: PumpType | null;
  drilling_method?: string | null;
  formation_water_type?: string;
  driller_name?: string | null;
  completion_date: string;
  warranty_expire_date?: string | null;   // GENERATED COLUMN
  warranty_status?: WarrantyStatus;
  warranty_remaining_days?: number | string | null;
  gps_accuracy_m?: number | null;
  notes?: string | null;
  // joined from drilling_jobs
  job_reference?: string;
  job_title?: string;
  site_address?: string;
  province?: string;
  district?: string;
  latitude?: number | null;
  longitude?: number | null;
  // joined from customers
  customer_name?: string;
}

export interface FullWell extends WellLog {
  strata:      WellStrataLog[];
  pipes:       WellPipe[];
  pumps:       WellPump[];
  maintenance?: any[];
}

export interface StatsOverview {
  jobs: {
    pending:   number;
    drilling:  number;
    completed: number;
    total:     number;
  };
  wells: {
    count:    number;
    avgDepth: number;
    maxDepth: number;
    avgWater: number;
  };
  warranty: {
    active:       number;
    expiringSoon: number;
    expired:      number;
  };
  strataBreakdown: {
    strata_type:   string;
    strata_label?: string;
    color_hex?:    string;
    segment_count: number;
    total_meters:  number;
  }[];
  recentJobs: {
    job_id: number;
    job_reference: string;
    job_title: string;
    status: JobStatus;
    scheduled_date: string;
    customer_name: string;
  }[];
}
