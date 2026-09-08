-- Password reset columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_code TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_method TEXT CHECK (reset_method IN ('email', 'sms'));

-- Ensure phone column exists (already in 0001_init.sql but safe to keep)
-- phone is already TEXT nullable in the original schema
