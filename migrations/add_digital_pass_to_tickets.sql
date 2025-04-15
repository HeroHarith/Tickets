-- Add digital pass columns to tickets table
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pass_id TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pass_url TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pass_type TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS pass_status TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS check_in_status TEXT;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS badge_info JSONB;

-- Create indexes to improve search performance
CREATE INDEX IF NOT EXISTS idx_tickets_pass_id ON tickets (pass_id);
CREATE INDEX IF NOT EXISTS idx_tickets_check_in_status ON tickets (check_in_status);