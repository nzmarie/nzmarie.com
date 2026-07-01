-- Migration: 007 - Create suburb_reports table
-- Database: Marie DB
-- Purpose: Store quarterly market report PDFs uploaded to Cloudflare R2

CREATE TABLE IF NOT EXISTS suburb_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Report Details
  suburb VARCHAR(100) NOT NULL,
  quarter VARCHAR(10) NOT NULL,  -- Format: 'Q1-2026', 'Q2-2026'
  year INT NOT NULL,
  
  -- File Information
  file_url TEXT NOT NULL,  -- Cloudflare R2 public URL
  file_name VARCHAR(255) NOT NULL,
  file_size INT,  -- Bytes
  
  -- Statistics
  download_count INT DEFAULT 0,
  view_count INT DEFAULT 0,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active',  -- 'draft', 'active', 'archived'
  
  -- Metadata
  uploaded_by VARCHAR(255),
  notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one report per suburb per quarter
CREATE UNIQUE INDEX IF NOT EXISTS idx_suburb_reports_suburb_quarter 
ON suburb_reports(suburb, quarter, year);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_suburb_reports_suburb ON suburb_reports(suburb);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_quarter ON suburb_reports(quarter, year);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_status ON suburb_reports(status);
CREATE INDEX IF NOT EXISTS idx_suburb_reports_uploaded_at ON suburb_reports(uploaded_at);

-- Updated_at trigger
CREATE TRIGGER trg_suburb_reports_updated_at
BEFORE UPDATE ON suburb_reports
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE suburb_reports IS 'Quarterly market reports stored in Cloudflare R2';
COMMENT ON COLUMN suburb_reports.quarter IS 'Format: Q1-2026, Q2-2026, etc.';
COMMENT ON COLUMN suburb_reports.file_url IS 'Public Cloudflare R2 URL';
