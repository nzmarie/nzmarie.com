import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as campaignStatsGET } from '@/app/api/admin/outreach/campaign-stats/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn(),
    ensureOutreachTablesExist: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

describe('GET /api/admin/outreach/campaign-stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds available campaigns from uploaded report sets merged with historical send-log campaigns', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'admin@test.com' },
    } as any);

    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [{ setting_value: '2026_Q2_Torbay' }],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          { suburb: 'Torbay', year: 2026, quarter: 'Q2' },
          { suburb: 'Oteha', year: 2026, quarter: 'Q1' },
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          { campaign_key: '2026_Q2_Torbay' },
          { campaign_key: '2025_Q4_Takapuna' },
        ],
      } as any);

    const response = await campaignStatsGET(
      new Request('http://localhost:3000/api/admin/outreach/campaign-stats')
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.available_campaigns).toContain('2026_Q2_Torbay');
    expect(data.available_campaigns).toContain('2026_Q1_Oteha');
    expect(data.available_campaigns).toContain('2025_Q4_Takapuna');
    // Newest quarter/year sorts first
    expect(data.available_campaigns[0]).toBe('2026_Q2_Torbay');
    // Admin-configured default campaign is surfaced so the page can pre-select it
    expect(data.default_campaign).toBe('2026_Q2_Torbay');
  });

  it('returns 401 for non-admin users', async () => {
    vi.mocked(auth).mockResolvedValueOnce(undefined as any);

    const response = await campaignStatsGET(
      new Request('http://localhost:3000/api/admin/outreach/campaign-stats')
    );
    expect(response.status).toBe(401);
  });
});
