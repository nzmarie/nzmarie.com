import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/admin/outreach/send/route';
import { GET } from '@/app/api/admin/outreach/[id]/history/route';
import { auth } from '@/lib/auth';
import { marieDB } from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn(),
    ensureOutreachTablesExist: vi.fn(),
  },
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

describe('Outreach Send and History API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/outreach/send', () => {
    it('returns 401 if unauthenticated', async () => {
      vi.mocked(auth).mockResolvedValueOnce(undefined as any);

      const request = new Request('http://localhost:3000/api/admin/outreach/send', {
        method: 'POST',
        body: JSON.stringify({ property_ids: ['prop-1'] }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('creates send log and updates property stats without changing lead status', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      vi.mocked(marieDB.query)
        .mockResolvedValueOnce({
          rows: [{ id: 'prop-1', suburb: 'Oteha' }],
        } as any)
        .mockResolvedValueOnce({
          rows: [{ id: 'log-1', outreach_property_id: 'prop-1', campaign_key: '2026_Q2_Oteha' }],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any);

      const request = new Request('http://localhost:3000/api/admin/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property_ids: ['prop-1'],
          report_title: 'Oteha 2026 Q2 Market Report',
          campaign_key: '2026_Q2_Oteha',
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.count).toBe(1);
    });
  });

  describe('GET /api/admin/outreach/[id]/history', () => {
    it('returns dispatch history for given property id', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      vi.mocked(marieDB.query).mockResolvedValueOnce({
        rows: [
          {
            log_id: 'log-1',
            outreach_property_id: 'prop-1',
            report_title: 'Oteha 2026 Q2 Market Report',
            campaign_key: '2026_Q2_Oteha',
            sent_at: '2026-06-15T00:00:00Z',
            scan_count: 2,
          },
        ],
      } as any);

      const response = await GET(new Request('http://localhost:3000/api/admin/outreach/prop-1/history'), {
        params: Promise.resolve({ id: 'prop-1' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.history.length).toBe(1);
      expect(data.history[0].campaign_key).toBe('2026_Q2_Oteha');
    });
  });
});
