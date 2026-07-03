-- =====================================================
-- Migration 013: Populate Street Field from Address
-- Created: 2026-07-03
-- Purpose: Extract and populate street names from existing addresses
-- =====================================================

-- Function to extract street name from full address
CREATE OR REPLACE FUNCTION extract_street_from_address(address TEXT)
RETURNS TEXT AS $$
DECLARE
  street_name TEXT;
BEGIN
  -- Remove leading number and optional unit (e.g., "5 ", "15A ", "123/456 ")
  street_name := REGEXP_REPLACE(address, '^\d+[A-Za-z]?(/\d+)?\s+', '');
  
  -- Take everything before the first comma (to remove suburb, city, etc.)
  street_name := SPLIT_PART(street_name, ',', 1);
  
  -- Trim whitespace
  street_name := TRIM(street_name);
  
  -- Return NULL if empty or too short
  IF street_name = '' OR LENGTH(street_name) < 3 THEN
    RETURN NULL;
  END IF;
  
  RETURN street_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update existing records with NULL or empty street
UPDATE outreach_properties 
SET street = extract_street_from_address(property_address)
WHERE street IS NULL OR street = '';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_outreach_street ON outreach_properties(street);

-- Create a composite index for the sorting query
CREATE INDEX IF NOT EXISTS idx_outreach_sort_order 
ON outreach_properties(suburb, street, created_at, property_address);

-- Add comment
COMMENT ON FUNCTION extract_street_from_address IS 'Extracts street name from full address string';

-- Display results
DO $$
DECLARE
  updated_count INTEGER;
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO updated_count 
  FROM outreach_properties 
  WHERE street IS NOT NULL AND street != '';
  
  SELECT COUNT(*) INTO null_count 
  FROM outreach_properties 
  WHERE street IS NULL OR street = '';
  
  RAISE NOTICE '✓ Migration 013 Complete';
  RAISE NOTICE '  - Updated records: %', updated_count;
  RAISE NOTICE '  - Still NULL: %', null_count;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================
