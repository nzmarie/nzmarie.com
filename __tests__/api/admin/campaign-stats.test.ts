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

  it('counts Pending as the full pending+sent list (excludes liked), split into unsent/sent/no-junk', async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: { email: 'admin@test.com' },
    } as any);

    // Query order for a per-campaign request:
    // 1. daily sends by campaign_key
    // 2. daily pending list (+ no-junk flags)
    // 3. interacted/converted status
    // 4. remaining (unsent)
    // 5. scans
    // 6. business card scans
    vi.mocked(marieDB.query)
      .mockResolvedValueOnce({
        rows: [
          { send_date: '2026-08-01', total_sent: 100 },
          { send_date: '2026-08-02', total_sent: 75 },
        ],
      } as any)
      .mockResolvedValueOnce({
        rows: [
          { day: '2026-06-01', daily_pending: 200, daily_no_junk: 50 },
          { day: '2026-06-02', daily_pending: 74, daily_no_junk: 27 },
        ],
      } as any)
      .mockResolvedValueOnce({ rows: [{ status: 'interacted', count: 2 }] } as any)
      .mockResolvedValueOnce({ rows: [{ remaining: 22 }] } as any)
      .mockResolvedValueOnce({ rows: [] } as any)
      .mockResolvedValueOnce({ rows: [] } as any);

    const response = await campaignStatsGET(
      new Request('http://localhost:3000/api/admin/outreach/campaign-stats?campaign=2026_Q2_Torbay')
    );
    expect(response.status).toBe(200);

    const data = await response.json();
    // pending = full list (pending + sent), junk is counted from the pending sublist only
    expect(data.summary.pending_count).toBe(274);
    expect(data.summary.sent_count).toBe(175);
    expect(data.summary.no_junk_mail_count).toBe(77);
    expect(data.summary.remaining_count).toBe(22);
    // unsent + sent + no-junk must equal the total Pending list
    expect(data.summary.remaining_count + data.summary.sent_count + data.summary.no_junk_mail_count)
      .toBe(data.summary.pending_count);
  });
});
