import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../../../app/api/admin/analytics/scans/route';

vi.mock('../../../lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('../../../lib/permissions', () => ({
  isSuperAdmin: vi.fn(),
}));

vi.mock('../../../lib/db', () => ({
  marieDB: {
    query: vi.fn(),
  },
}));

vi.mock('../../../lib/campaign-tracker', () => ({
  ensureCampaignTablesExist: vi.fn().mockResolvedValue(undefined),
}));

import { auth } from '../../../lib/auth';
import { isSuperAdmin } from '../../../lib/permissions';
import { marieDB } from '../../../lib/db';

describe('GET /api/admin/analytics/scans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 if user is not authenticated or not super admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);

    const req = new Request('https://www.nzmarie.com/api/admin/analytics/scans');
    const res = await GET(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe('Forbidden');
  });

  it('returns scan analytics summary and visit logs for super admin', async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: { email: 'louis@example.com' } } as any);
    vi.mocked(isSuperAdmin).mockReturnValueOnce(true);

    const mockSummary = { rows: [{ total_pv: '42', total_uv: '30' }], rowCount: 1, command: '', oid: 0, fields: [] };
    const mockCampaigns = {
      rows: [{ campaign_key: 'oteha', campaign_name: 'Oteha Campaign', total_pv: 42, total_uv: 30, last_visited_at: '2026-07-23T10:00:00Z' }],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    };
    const mockLogs = {
      rows: [
        {
          id: 'log-1',
          campaign_key: 'oteha',
          visitor_hash: 'abc123hash',
          ip_address: '127.0.0.1',
          user_agent: 'Safari',
          device_type: 'mobile',
          referrer: '',
          is_unique: true,
          created_at: '2026-07-23T10:00:00Z',
        },
      ],
      rowCount: 1,
      command: '',
      oid: 0,
      fields: [],
    };

    (marieDB.query as any)
      .mockResolvedValueOnce(mockSummary)
      .mockResolvedValueOnce(mockCampaigns)
      .mockResolvedValueOnce(mockLogs);

    const req = new Request('https://www.nzmarie.com/api/admin/analytics/scans');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.total_scans).toBe(42);
    expect(data.total_unique).toBe(30);
    expect(data.campaigns).toHaveLength(1);
    expect(data.logs).toHaveLength(1);
  });
});
