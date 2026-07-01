-- Migration: 008 - Create automatic tracking triggers
-- Database: Marie DB
-- Purpose: Auto-update engagement status when users download reports or request appraisals

-- ========================================
-- Trigger 1: Auto-update on Report Download
-- ========================================
-- When a user downloads a report, automatically update:
-- 1. direct_mail_addresses.has_downloaded = TRUE
-- 2. outreach_tasks.has_downloaded = TRUE

CREATE OR REPLACE FUNCTION update_download_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Update direct_mail_addresses (if tracking code exists)
  IF NEW.tracking_code IS NOT NULL THEN
    UPDATE direct_mail_addresses
    SET 
      has_downloaded = TRUE,
      download_count = download_count + 1,
      first_download_at = COALESCE(first_download_at, NEW.downloaded_at),
      last_download_at = NEW.downloaded_at,
      updated_at = NOW()
    WHERE tracking_code = NEW.tracking_code
    AND has_downloaded = FALSE;
  END IF;

  -- Update outreach_tasks (by suburb match)
  UPDATE outreach_tasks
  SET 
    has_downloaded = TRUE,
    updated_at = NOW()
  WHERE suburb = NEW.suburb
  AND tracking_code = NEW.tracking_code
  AND has_downloaded = FALSE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_update_download_tracking ON report_downloads;
CREATE TRIGGER trg_update_download_tracking
AFTER INSERT ON report_downloads
FOR EACH ROW
EXECUTE FUNCTION update_download_tracking();

-- ========================================
-- Trigger 2: Auto-update on Appraisal Request
-- ========================================
-- When a user requests an appraisal, automatically update:
-- 1. direct_mail_addresses.has_requested_appraisal = TRUE
-- 2. outreach_tasks.has_requested_appraisal = TRUE

CREATE OR REPLACE FUNCTION update_appraisal_tracking()
RETURNS TRIGGER AS $$
BEGIN
  -- Update direct_mail_addresses (by address + suburb match)
  UPDATE direct_mail_addresses
  SET 
    has_requested_appraisal = TRUE,
    appraisal_request_at = NEW.created_at,
    contact_status = CASE 
      WHEN contact_status = 'not_contacted' THEN 'interested'
      ELSE contact_status
    END,
    updated_at = NOW()
  WHERE property_address = NEW.property_address
  AND suburb = NEW.suburb
  AND has_requested_appraisal = FALSE;

  -- Update outreach_tasks (by address + suburb match)
  UPDATE outreach_tasks
  SET 
    has_requested_appraisal = TRUE,
    updated_at = NOW()
  WHERE property_address = NEW.property_address
  AND suburb = NEW.suburb
  AND has_requested_appraisal = FALSE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_update_appraisal_tracking ON appraisal_leads;
CREATE TRIGGER trg_update_appraisal_tracking
AFTER INSERT ON appraisal_leads
FOR EACH ROW
EXECUTE FUNCTION update_appraisal_tracking();

-- ========================================
-- Trigger 3: Update Campaign Stats
-- ========================================
-- When direct_mail_addresses are updated, recalculate campaign stats

CREATE OR REPLACE FUNCTION update_campaign_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE direct_mail_campaigns
  SET
    download_count = (
      SELECT COUNT(*) 
      FROM direct_mail_addresses 
      WHERE campaign_id = NEW.campaign_id AND has_downloaded = TRUE
    ),
    appraisal_count = (
      SELECT COUNT(*) 
      FROM direct_mail_addresses 
      WHERE campaign_id = NEW.campaign_id AND has_requested_appraisal = TRUE
    ),
    conversion_count = (
      SELECT COUNT(*) 
      FROM direct_mail_addresses 
      WHERE campaign_id = NEW.campaign_id AND is_converted = TRUE
    ),
    total_revenue = (
      SELECT COALESCE(SUM(conversion_value), 0)
      FROM direct_mail_addresses 
      WHERE campaign_id = NEW.campaign_id AND is_converted = TRUE
    ),
    updated_at = NOW()
  WHERE id = NEW.campaign_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS trg_update_campaign_stats ON direct_mail_addresses;
CREATE TRIGGER trg_update_campaign_stats
AFTER UPDATE OR INSERT ON direct_mail_addresses
FOR EACH ROW
WHEN (
  NEW.has_downloaded != OLD.has_downloaded OR
  NEW.has_requested_appraisal != OLD.has_requested_appraisal OR
  NEW.is_converted != OLD.is_converted OR
  NEW.conversion_value != OLD.conversion_value
)
EXECUTE FUNCTION update_campaign_stats();

-- Comments
COMMENT ON FUNCTION update_download_tracking IS 'Auto-updates tracking when user downloads PDF report';
COMMENT ON FUNCTION update_appraisal_tracking IS 'Auto-updates tracking when user requests appraisal';
COMMENT ON FUNCTION update_campaign_stats IS 'Auto-recalculates campaign statistics';
