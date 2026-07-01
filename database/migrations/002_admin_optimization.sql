-- =====================================================
-- Admin System Optimization Migration
-- Created: 2026-06-29
-- Purpose: Add download tracking, direct mail campaigns, and enhanced features
-- =====================================================

-- =====================================================
-- 1. Ensure appraisal_leads has suburb field (already exists, add if missing)
-- =====================================================
ALTER TABLE appraisal_leads 
ADD COLUMN IF NOT EXISTS suburb VARCHAR(100);

-- Add index if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_appraisal_suburb'
    ) THEN
        CREATE INDEX idx_appraisal_suburb ON appraisal_leads(suburb);
    END IF;
END $$;

-- =====================================================
-- 2. Enhanced report_downloads table with tracking
-- =====================================================
-- Add new columns if they don't exist
ALTER TABLE report_downloads
ADD COLUMN IF NOT EXISTS name VARCHAR(255),
ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
ADD COLUMN IF NOT EXISTS ip_address INET,
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS tracking_code VARCHAR(50);

-- Add indexes
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_downloads_tracking_code') THEN
        CREATE INDEX idx_downloads_tracking_code ON report_downloads(tracking_code);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_downloads_source') THEN
        CREATE INDEX idx_downloads_source ON report_downloads(source);
    END IF;
END $$;

-- =====================================================
-- 3. Create direct_mail_campaigns table
-- =====================================================
CREATE TABLE IF NOT EXISTS direct_mail_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign info
  campaign_name VARCHAR(200) NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  campaign_type VARCHAR(50) DEFAULT 'quarterly_report',
  
  -- Timing
  planned_date DATE,
  sent_date DATE NOT NULL,
  quarter VARCHAR(10),
  
  -- Stats
  total_addresses INT DEFAULT 0,
  total_printed INT DEFAULT 0,
  total_delivered INT DEFAULT 0,
  
  -- Status
  status VARCHAR(50) DEFAULT 'planned',
  
  -- Financial (Louis only)
  printing_cost DECIMAL(10, 2),
  postage_cost DECIMAL(10, 2),
  total_cost DECIMAL(10, 2) GENERATED ALWAYS AS (
    COALESCE(printing_cost, 0) + COALESCE(postage_cost, 0)
  ) STORED,
  
  -- Metadata
  created_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_suburb ON direct_mail_campaigns(suburb);
CREATE INDEX IF NOT EXISTS idx_campaigns_sent_date ON direct_mail_campaigns(sent_date);
CREATE INDEX IF NOT EXISTS idx_campaigns_quarter ON direct_mail_campaigns(quarter);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON direct_mail_campaigns(status);

-- =====================================================
-- 4. Create direct_mail_addresses table (CORE TABLE)
-- =====================================================
CREATE TABLE IF NOT EXISTS direct_mail_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Campaign link
  campaign_id UUID NOT NULL REFERENCES direct_mail_campaigns(id) ON DELETE CASCADE,
  
  -- Property info
  property_id UUID,
  property_address TEXT NOT NULL,
  street VARCHAR(255),
  suburb VARCHAR(100) NOT NULL,
  
  -- Owner info (optional)
  owner_name VARCHAR(255),
  owner_email VARCHAR(255),
  owner_phone VARCHAR(50),
  
  -- Mailing info
  mailed_date DATE NOT NULL,
  tracking_code VARCHAR(50) UNIQUE NOT NULL,
  mail_status VARCHAR(20) DEFAULT 'SENT',
  
  -- Auto-tracking (updated by triggers)
  has_downloaded BOOLEAN DEFAULT FALSE,
  download_count INT DEFAULT 0,
  first_download_at TIMESTAMPTZ,
  last_download_at TIMESTAMPTZ,
  
  has_requested_appraisal BOOLEAN DEFAULT FALSE,
  appraisal_requested_at TIMESTAMPTZ,
  appraisal_lead_id UUID REFERENCES appraisal_leads(id) ON DELETE SET NULL,
  
  -- Marie's manual fields
  contact_status VARCHAR(50) DEFAULT 'not_contacted',
  contact_attempts INT DEFAULT 0,
  last_contact_at TIMESTAMPTZ,
  next_follow_up_at DATE,
  follow_up_type VARCHAR(50),
  agent_notes TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  
  -- Conversion (Louis only)
  is_converted BOOLEAN DEFAULT FALSE,
  converted_at TIMESTAMPTZ,
  conversion_value DECIMAL(12, 2),
  commission_rate DECIMAL(5, 2),
  commission_amount DECIMAL(10, 2),
  
  -- Quarterly follow-up
  next_quarter_action VARCHAR(100),
  next_quarter_scheduled_at DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by VARCHAR(255)
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_dma_campaign_id ON direct_mail_addresses(campaign_id);
CREATE INDEX IF NOT EXISTS idx_dma_suburb ON direct_mail_addresses(suburb);
CREATE INDEX IF NOT EXISTS idx_dma_contact_status ON direct_mail_addresses(contact_status);
CREATE INDEX IF NOT EXISTS idx_dma_next_follow_up ON direct_mail_addresses(next_follow_up_at) WHERE next_follow_up_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_dma_mailed_date ON direct_mail_addresses(mailed_date);
CREATE INDEX IF NOT EXISTS idx_dma_tracking_code ON direct_mail_addresses(tracking_code);
CREATE INDEX IF NOT EXISTS idx_dma_has_downloaded ON direct_mail_addresses(has_downloaded);
CREATE INDEX IF NOT EXISTS idx_dma_has_requested_appraisal ON direct_mail_addresses(has_requested_appraisal);
CREATE INDEX IF NOT EXISTS idx_dma_is_converted ON direct_mail_addresses(is_converted);
CREATE INDEX IF NOT EXISTS idx_dma_owner_email ON direct_mail_addresses(owner_email);

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS idx_dma_campaign_address 
ON direct_mail_addresses(campaign_id, property_address);

-- =====================================================
-- 5. Helper Functions
-- =====================================================

-- Function: Check download limit (5 per month per email+suburb)
CREATE OR REPLACE FUNCTION check_download_limit(
  p_email VARCHAR(255),
  p_suburb VARCHAR(100)
) RETURNS JSON AS $$
DECLARE
  v_count INT;
  v_can_download BOOLEAN;
  v_message TEXT;
  v_reset_date TIMESTAMPTZ;
BEGIN
  -- Count downloads this month
  SELECT COUNT(*) INTO v_count
  FROM report_downloads
  WHERE email = p_email
  AND suburb = p_suburb
  AND downloaded_at >= date_trunc('month', CURRENT_TIMESTAMP);
  
  -- Check limit (5 per month)
  v_can_download := (v_count < 5);
  v_reset_date := date_trunc('month', CURRENT_TIMESTAMP) + interval '1 month';
  
  IF v_can_download THEN
    v_message := format('You can download %s more times this month', 5 - v_count);
  ELSE
    v_message := 'Download limit reached for this month (5 downloads max)';
  END IF;
  
  RETURN json_build_object(
    'can_download', v_can_download,
    'current_count', v_count,
    'limit', 5,
    'remaining', GREATEST(0, 5 - v_count),
    'message', v_message,
    'reset_date', v_reset_date
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Triggers
-- =====================================================

-- Trigger: Update updated_at on campaigns
DROP TRIGGER IF EXISTS trg_update_campaign_timestamp ON direct_mail_campaigns;
CREATE TRIGGER trg_update_campaign_timestamp
BEFORE UPDATE ON direct_mail_campaigns
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Update updated_at on addresses
DROP TRIGGER IF EXISTS trg_update_address_timestamp ON direct_mail_addresses;
CREATE TRIGGER trg_update_address_timestamp
BEFORE UPDATE ON direct_mail_addresses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Track downloads automatically
CREATE OR REPLACE FUNCTION update_download_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Update direct_mail_addresses when someone downloads
  UPDATE direct_mail_addresses
  SET 
    has_downloaded = TRUE,
    download_count = download_count + 1,
    last_download_at = NEW.downloaded_at,
    first_download_at = COALESCE(first_download_at, NEW.downloaded_at),
    updated_at = NOW(),
    contact_status = CASE 
      WHEN contact_status = 'not_contacted' THEN 'attempted'
      ELSE contact_status
    END,
    priority = CASE 
      WHEN download_count + 1 >= 3 AND priority = 'medium' THEN 'high'
      WHEN download_count + 1 >= 3 AND priority = 'low' THEN 'medium'
      ELSE priority
    END
  WHERE tracking_code = NEW.tracking_code
  OR (suburb = NEW.suburb AND owner_email = NEW.email);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_download_tracking ON report_downloads;
CREATE TRIGGER trg_update_download_tracking
AFTER INSERT ON report_downloads
FOR EACH ROW
EXECUTE FUNCTION update_download_tracking();

-- Trigger: Track appraisal requests automatically
CREATE OR REPLACE FUNCTION update_appraisal_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Update direct_mail_addresses when someone requests appraisal
  UPDATE direct_mail_addresses
  SET 
    has_requested_appraisal = TRUE,
    appraisal_requested_at = NEW.created_at,
    appraisal_lead_id = NEW.id,
    contact_status = 'interested',
    priority = 'high',
    updated_at = NOW(),
    next_follow_up_at = COALESCE(next_follow_up_at, CURRENT_DATE)
  WHERE (property_address = NEW.property_address AND suburb = NEW.suburb)
  OR (owner_email = NEW.email AND suburb = NEW.suburb);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_appraisal_tracking ON appraisal_leads;
CREATE TRIGGER trg_update_appraisal_tracking
AFTER INSERT ON appraisal_leads
FOR EACH ROW
EXECUTE FUNCTION update_appraisal_tracking();

-- =====================================================
-- 7. Update campaign stats automatically
-- =====================================================
CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE direct_mail_campaigns
    SET 
      total_addresses = (
        SELECT COUNT(*) 
        FROM direct_mail_addresses 
        WHERE campaign_id = NEW.campaign_id
      ),
      updated_at = NOW()
    WHERE id = NEW.campaign_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE direct_mail_campaigns
    SET 
      total_addresses = (
        SELECT COUNT(*) 
        FROM direct_mail_addresses 
        WHERE campaign_id = OLD.campaign_id
      ),
      updated_at = NOW()
    WHERE id = OLD.campaign_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_campaign_stats ON direct_mail_addresses;
CREATE TRIGGER trg_update_campaign_stats
AFTER INSERT OR DELETE ON direct_mail_addresses
FOR EACH ROW
EXECUTE FUNCTION update_campaign_stats();

-- =====================================================
-- Migration Complete
-- =====================================================
