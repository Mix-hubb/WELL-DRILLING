// ============================================================
// Types ตาม docs/database-schema.md (MySQL well_drilling)
// ============================================================

// ---------- Enums ----------
export type UserRole    = "USER";

export type DrillingRequestStatus = "NEW" | "QUOTED" | "ACCEPTED" | "REJECTED" | "CANCELLED";
export type RequestSource = "GOOGLE_FORM" | "MANUAL" | "LINE";

export type DrillingJobStatus = "QUEUED" | "DRILLING" | "SUCCESS" | "FAILED" | "CLOSED";
export type DrillingResult = "SUCCESS" | "FAILED";

export type RepairRequestStatus =
  | "NEW" | "QUOTED" | "ACCEPTED" | "REJECTED"
  | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type QuotationKind   = "DRILLING" | "REPAIR";
export type QuotationStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export type WellResult   = "SUCCESS" | "FAIL";
export type DrillingMethod = "ROTARY" | "DTH" | "CABLE_TOOL" | "AUGER" | "JETTING" | "OTHER";
export type WaterType    = "FRESH" | "BRACKISH" | "SALINE" | "UNKNOWN";
export type Hardness     = "VERY_SOFT" | "SOFT" | "MEDIUM" | "HARD" | "VERY_HARD";
export type PipeMaterial = "PVC" | "STEEL" | "STAINLESS_STEEL" | "HDPE" | "OTHER";
export type PipeType     = "CASING" | "SCREEN";
export type PumpType     = "AC_SUBMERSIBLE" | "DC_SOLAR_SUBMERSIBLE" | "OTHER";
export type LithologyType =
  | "TOP_SOIL" | "CLAY" | "SAND" | "GRAVEL" | "LATERITE"
  | "SANDSTONE" | "SHALE" | "LIMESTONE" | "GRANITE" | "BASALT"
  | "HARDROCK" | "OTHER";
export type PumpBrand =
  | "FRANKLIN" | "TORQUE" | "GRUNDFOS" | "HITACHI" | "PEDROLLO"
  | "MITSUBISHI" | "KSB" | "TSURUMI" | "LOWARA" | "OTHER";
export type ControlBoxProtection =
  | "OVERLOAD_RELAY" | "CIRCUIT_BREAKER" | "AUTO_RESTART" | "WATER_LEVEL"
  | "LIGHTNING" | "NONE" | "OTHER";

export interface PumpCatalogModel {
  model_id: number;
  brand: string;
  series?: string | null;
  model: string;
  bore_size?: string | null;
  flow_rate?: string | null;
  motor_power?: string | null;
  phase?: string | null;
  discharge_size?: string | null;
  impeller_stages?: string | null;
  max_head_m?: string | null;
  material?: string | null;
  features?: string | null;
  reference_price?: number | null;
  notes?: string | null;
  sort_order?: number;
  is_active: number;
  created_at?: string;
  updated_at?: string;
}

export type WarrantyStatus = "UNKNOWN" | "ACTIVE" | "EXPIRED";
export type AlertTier    = "ACTIVE" | "EXPIRING_SOON" | "EXPIRED";

// ============================================================
export interface User {
  user_id: number;
  email: string;
  password_hash?: string;
  full_name: string;
  phone?: string | null;
  role: UserRole;
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  customer_id: number;
  user_id?: number | null;
  line_user_id?: string | null;
  customer_name: string;
  phone: string;
  phone_alt?: string | null;
  address?: string | null;
  line_display_name?: string | null;
  line_picture_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

// ---------- wells + detail tables ----------
export interface Well {
  well_id: number;
  customer_id: number;
  well_name: string;
  address?: string | null;
  requested_depth_m?: number | null;
  total_depth_m?: number | null;
  drilling_method?: DrillingMethod | null;
  formation_water_type?: WaterType | null;
  water_quantity_m3hr?: number | null;
  yield_lpm?: number | null;
  static_water_level_m?: number | null;
  pumping_water_level_m?: number | null;
  driller_name?: string | null;
  completion_date?: string | null;
  warranty_expire_date?: string | null;   // GENERATED COLUMN = completion_date + 2 ปี
  result?: WellResult | null;
  failure_reason?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // joined from customers
  customer_name?: string;
  customer_phone?: string;
  // joined from well_warranty_view
  days_left?: number | null;
  warranty_status?: WarrantyStatus | null;
}

export interface WellStrataLog {
  strata_id: number;
  well_id: number;
  depth_from_m: number;
  depth_to_m: number;
  lithology_type?: LithologyType | null;
  lithology_name?: string | null;
  color_hex?: string | null;
  hardness?: Hardness | null;
  water_bearing: number;   // TINYINT 0|1
  description?: string | null;
}

export interface WellPipe {
  pipe_id: number;
  well_id: number;
  material?: PipeMaterial | null;
  pipe_type?: PipeType | null;
  size_mm?: number | null;
  depth_from_m: number;
  depth_to_m: number;
  quantity: number;   // DEFAULT 1
  notes?: string | null;
}

export interface WellPump {
  pump_id: number;
  well_id: number;
  pump_type?: PumpType | null;
  brand?: string | null;
  pump_model?: string | null;
  horsepower?: number | null;
  power_kw?: number | null;
  impeller_stages?: number | null;
  installation_depth_m?: number | null;
  voltage?: string | null;
  phase?: number | null;
  discharge_size_mm?: number | null;
  rated_flow_m3hr?: number | null;
  rated_head_m?: number | null;
  installed_date?: string | null;
  notes?: string | null;
}

export interface WellControlBox {
  control_box_id: number;
  well_id: number;
  brand?: string | null;
  model?: string | null;
  capacity?: string | null;
  voltage?: string | null;
  protection_type?: ControlBoxProtection | null;
  features?: string | null;
  installed_date?: string | null;
  notes?: string | null;
}

export interface FullWell extends Well {
  strata:       WellStrataLog[];
  pipes:        WellPipe[];
  pumps:        WellPump[];
  control_boxes: WellControlBox[];
}

// ---------- Flow A: drilling requests + jobs ----------
export interface DrillingRequest {
  request_id: number;
  customer_id: number;
  source?: RequestSource | null;
  name: string;
  phone: string;
  address: string;
  requested_depth_m?: number | null;
  status: DrillingRequestStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // joined
  customer_name?: string;
  customer_phone?: string;
  quotation?: Quotation | null;
  job?: DrillingJob | null;
}

export interface DrillingJob {
  job_id: number;
  request_id?: number | null;
  customer_id: number;
  well_id?: number | null;
  status: DrillingJobStatus;
  result?: DrillingResult | null;
  failure_reason?: string | null;
  job_title?: string | null;
  site_address?: string | null;
  province?: string | null;
  district?: string | null;
  scheduled_date?: string | null;   // NULL = Queue Pool
  magic_link_token?: string | null;
  magic_link_expires_at?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  // joined
  customer_name?: string;
  customer_phone?: string;
  well_name?: string | null;
  warranty_expire_date?: string | null;
  request?: DrillingRequest | null;
  quotation?: Quotation | null;
}

// ---------- Flow B: repair requests + records ----------
export interface RepairRequest {
  repair_id: number;
  customer_id: number;
  well_id?: number | null;
  problems: string[];           // JSON array
  detail?: string | null;
  photos?: string[] | null;     // JSON array
  scheduled_date?: string | null;
  status: RepairRequestStatus;
  magic_link_token?: string | null;
  magic_link_expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
  // joined
  customer_name?: string;
  customer_phone?: string;
  well_name?: string | null;
  quotation?: Quotation | null;
  records?: RepairRecord[];
}

export interface Quotation {
  quotation_id: number;
  kind: QuotationKind;
  drilling_request_id?: number | null;
  repair_request_id?: number | null;
  price: number;
  status: QuotationStatus;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface RepairRecord {
  record_id: number;
  repair_id: number;
  final_price?: number | null;
  work_details?: string | null;
  parts?: { name: string; qty: number; unit_price: number }[] | null;   // JSON
  pump?: PumpCatalogModel | null;                                        // JSON: ปั๊มที่เปลี่ยนระหว่างซ่อม
  payment_slip_url?: string | null;
  is_warranty_claim: number;    // TINYINT 0|1
  completed_at?: string | null;
  created_at?: string;
}

// ---------- LINE ----------
export interface LineNotification {
  notification_id: number;
  customer_id: number;
  kind?: "QUOTE" | "STATUS" | "REMINDER" | "OTHER" | null;
  content?: string | null;
  line_message_id?: string | null;
  status: "SENT" | "FAILED";
  sent_at?: string;
}

// ---------- Stats ----------
export interface StatsOverview {
  requests: {
    new:       number;
    quoted:    number;
    accepted:  number;
  };
  jobs: {
    queued:    number;
    drilling:  number;
    success:   number;
    failed:    number;
    closed:    number;
    total:     number;
  };
  repairs: {
    new:       number;
    inProgress: number;
    completed: number;
  };
  wells: {
    count:    number;
    avgDepth: number;
    maxDepth: number;
    avgWater: number;
  };
  warranty: {
    active:   number;
    expiringSoon: number;
    expired:  number;
  };
  recentJobs: {
    job_id: number;
    job_title: string;
    status: DrillingJobStatus;
    customer_name: string;
    scheduled_date?: string | null;
  }[];
}
