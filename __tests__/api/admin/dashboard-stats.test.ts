import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('@/lib/drizzle', () => ({
  db: { execute: vi.fn() },
}));

vi.mock('@/lib/redis', () => ({
  getCachedOrFetch: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
}));

vi.mock('@/lib/campaign-tracker', () => ({
  ensureCampaignTablesExist: vi.fn(),
}));

import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/permissions';
import { db } from '@/lib/drizzle';
import { GET } from '../../../app/api/admin/dashboard/stats/route';

function makeRequest(suburb?: string) {
  const url = suburb
    ? `http://localhost/api/admin/dashboard/stats?suburb=${suburb}`
    : 'http://localhost/api/admin/dashboard/stats';
  return new Request(url);
}

describe('GET /api/admin/dashboard/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ user: { email: 'admin@test.com' } } as any);
    vi.mocked(isAdmin).mockReturnValue(true);
  });

  it('returns 200 with stats structure', async () => {
    const mockRow = {
      new_leads: '5',
      high_priority_leads: '2',
      pending_outreach: '10',
      sent_outreach: '20',
      today_followups: '3',
      overdue_followups: '1',
      today_downloads: '7',
      total_downloads: '100',
      month_downloads: '30',
      total_bookings: '50',
      month_bookings: '12',
      qr_codes_total: '8',
      pdf_reports_total: '15',
      outreach_by_suburb: [{ suburb: 'Albany', pending_count: 5, sent_count: 10, total_count: 15 }],
      recent_downloads: [{ id: '1', email: 'a@b.com', name: 'T', suburb: 'Albany', downloaded_at: new Date().toISOString(), source: 'organic', tracking_code: null }],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.stats.newLeads).toBe(5);
    expect(body.stats.highPriorityLeads).toBe(2);
    expect(body.stats.pendingOutreach).toBe(10);
    expect(body.stats.sentOutreach).toBe(20);
    expect(body.stats.sentSummary).toEqual({
      total_sent: 10,
      suburb_count: 1,
      suburbs: [{ suburb: 'Albany', sent_count: 10 }],
    });
    expect(body.stats.outreachBySuburb).toHaveLength(1);
    expect(body.stats.scanStats).toEqual({
      total_scans: 0,
      total_unique: 0,
      campaigns: [],
    });
    expect(body.stats.downloadsBySuburb).toEqual([]);
    expect(body.stats.recentDownloads).toHaveLength(1);
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ user: null } as any);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 when not admin', async () => {
    vi.mocked(isAdmin).mockReturnValue(false);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 500 on database error', async () => {
    vi.mocked(db.execute).mockRejectedValue(new Error('DB error'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it('returns zeroes when all counts are null', async () => {
    const emptyRow = {
      new_leads: null, high_priority_leads: null, pending_outreach: null,
      sent_outreach: null, today_followups: null, overdue_followups: null,
      today_downloads: null, total_downloads: null, month_downloads: null,
      total_bookings: null, month_bookings: null, qr_codes_total: null,
      pdf_reports_total: null, outreach_by_suburb: null, recent_downloads: null,
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [emptyRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.newLeads).toBe(0);
    expect(body.stats.outreachBySuburb).toEqual([]);
    expect(body.stats.recentDownloads).toEqual([]);
  });

  it('passes suburb filter to query', async () => {
    const mockRow = {
      new_leads: '3', high_priority_leads: '1', pending_outreach: '5',
      sent_outreach: '10', today_followups: '2', overdue_followups: '0',
      today_downloads: '4', total_downloads: '50', month_downloads: '15',
      total_bookings: '25', month_bookings: '8', qr_codes_total: '4',
      pdf_reports_total: '10', outreach_by_suburb: null, recent_downloads: null,
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest('Takapuna'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.suburb).toBe('Takapuna');
    expect(body.stats.newLeads).toBe(3);
  });

  it('queries live outreach tables for sent summary', async () => {
    const mockRow = {
      new_leads: '1', high_priority_leads: '0', pending_outreach: '2',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      sent_summary_suburbs: [
        { suburb: 'Albany', sent_count: 5 },
        { suburb: 'Torbay', sent_count: 3 },
      ],
      sent_summary_suburb_count: '2',
      sent_summary_total_sent: '8',
    };

    let capturedSql = '';
    vi.mocked(db.execute).mockImplementation(((sql: any) => {
      capturedSql = JSON.stringify(sql?.queryChunks ?? []);
      return { rows: [mockRow] };
    }) as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(capturedSql).toContain('FROM outreach_properties');
    expect(capturedSql).toContain('WHERE LOWER(status) = \'sent\'');
    expect(capturedSql).toContain('FROM campaign_analytics');
    expect(capturedSql).not.toContain('outreach_selected_properties');
    expect(body.stats.sentSummary).toEqual({
      total_sent: 8,
      suburb_count: 2,
      suburbs: [
        { suburb: 'Albany', sent_count: 5 },
        { suburb: 'Torbay', sent_count: 3 },
      ],
    });
  });

  it('returns scan stats and normalizes campaign names', async () => {
    const mockRow = {
      new_leads: '1', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '0', total_downloads: '0', month_downloads: '0',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      total_scans: '42',
      total_unique_scans: '18',
      scan_campaigns: [
        { campaign_key: '2026_Q2_Torbay', campaign_name: 'Torbay campaign', total_pv: '30', total_uv: '12' },
        { campaign_key: '2026_Q2_Albany', campaign_name: '', total_pv: '12', total_uv: '6' },
      ],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.scanStats).toEqual({
      total_scans: 42,
      total_unique: 18,
      campaigns: [
        { campaign_key: '2026_Q2_Torbay', campaign_name: 'Torbay Campaign', total_pv: 30, total_uv: 12 },
        { campaign_key: '2026_Q2_Albany', campaign_name: '2026 Q2 Albany', total_pv: 12, total_uv: 6 },
      ],
    });
  });

  it('returns downloads by suburb breakdown', async () => {
    const mockRow = {
      new_leads: '1', high_priority_leads: '0', pending_outreach: '0',
      sent_outreach: '0', today_followups: '0', overdue_followups: '0',
      today_downloads: '2', total_downloads: '12', month_downloads: '5',
      total_bookings: '0', month_bookings: '0', qr_codes_total: '0',
      pdf_reports_total: '0', outreach_by_suburb: null, recent_downloads: null,
      downloads_by_suburb: [
        { suburb: 'Torbay', download_count: '7' },
        { suburb: 'Albany', download_count: '5' },
      ],
    };

    vi.mocked(db.execute).mockResolvedValue({ rows: [mockRow] } as any);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.stats.totalDownloads).toBe(12);
    expect(body.stats.downloadsBySuburb).toEqual([
      { suburb: 'Torbay', download_count: 7 },
      { suburb: 'Albany', download_count: 5 },
    ]);
  });
});
