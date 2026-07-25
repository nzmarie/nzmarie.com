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
    expect(body.stats.outreachBySuburb).toHaveLength(1);
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
});
