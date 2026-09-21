-- Performance indexes for load testing
-- Run on Supabase Dashboard > SQL Editor

CREATE INDEX IF NOT EXISTS idx_drilling_jobs_created ON drilling_jobs(created_at DESC);
