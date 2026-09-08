-- Performance indexes for load testing
-- Run on Supabase Dashboard > SQL Editor

CREATE INDEX IF NOT EXISTS idx_drilling_jobs_created ON drilling_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_drilling_requests_customer ON drilling_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_requests_customer ON repair_requests(customer_id);
CREATE INDEX IF NOT EXISTS idx_wells_customer ON wells(customer_id);
