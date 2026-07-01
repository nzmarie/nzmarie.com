/**
 * Address Parser Utility
 * 
 * Extracts suburb information from full New Zealand addresses
 */

// Common NZ suburbs on Auckland North Shore
export const NZ_SUBURBS = [
  'Albany',
  'Browns Bay',
  'Campbells Bay',
  'Castor Bay',
  'Devonport',
  'Forrest Hill',
  'Glenfield',
  'Greenhithe',
  'Mairangi Bay',
  'Milford',
  'Murrays Bay',
  'Northcote',
  'Northcross',
  'North Shore',
  'Pinehill',
  'Rothesay Bay',
  'Takapuna',
  'Torbay',
  'Wairau Valley',
  'Windsor Park',
] as const;

export type Suburb = typeof NZ_SUBURBS[number];

/**
 * Extract suburb from full address string
 * 
 * Examples:
 * - "12 Queen Street, Albany, Auckland" → "Albany"
 * - "5 Beach Road, Takapuna" → "Takapuna"
 * - "Unit 3, 45 Main St, Browns Bay, Auckland 0630" → "Browns Bay"
 */
export function extractSuburb(fullAddress: string): string | null {
  if (!fullAddress || typeof fullAddress !== 'string') {
    return null;
  }

  const normalized = fullAddress.trim();
  
  // Check if any known suburb appears in the address
  for (const suburb of NZ_SUBURBS) {
    // Case-insensitive match, word boundary
    const regex = new RegExp(`\\b${suburb}\\b`, 'i');
    if (regex.test(normalized)) {
      return suburb;
    }
  }

  // Fallback: try to extract from comma-separated parts
  // Typical format: "Street, Suburb, City"
  const parts = normalized.split(',').map(s => s.trim());
  
  if (parts.length >= 2) {
    const potentialSuburb = parts[parts.length - 2]; // Second to last part
    
    // Check if it matches a known suburb
    for (const suburb of NZ_SUBURBS) {
      if (potentialSuburb.toLowerCase() === suburb.toLowerCase()) {
        return suburb;
      }
    }
  }

  return null;
}

/**
 * Check if a string is a valid suburb
 */
export function isValidSuburb(value: unknown): value is Suburb {
  return typeof value === 'string' && NZ_SUBURBS.includes(value as Suburb);
}

/**
 * Get suburb options for dropdown
 */
export function getSuburbOptions(): { value: string; label: string }[] {
  return NZ_SUBURBS.map(suburb => ({
    value: suburb,
    label: suburb,
  }));
}

/**
 * Validate and normalize suburb input
 */
export function normalizeSuburb(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const normalized = input.trim();
  
  // Find case-insensitive match
  for (const suburb of NZ_SUBURBS) {
    if (normalized.toLowerCase() === suburb.toLowerCase()) {
      return suburb;
    }
  }

  return null;
}
