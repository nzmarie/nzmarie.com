import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as uploadPOST } from '@/app/api/admin/pdf/upload/route';
import { GET as reportsGET } from '@/app/api/admin/pdf/reports/route';
import { POST as downloadPOST } from '@/app/api/reports/download/route';
import { auth } from '@/lib/auth';
import { marieDB, query } from '@/lib/db';

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  marieDB: {
    query: vi.fn(),
    ensureOutreachTablesExist: vi.fn().mockResolvedValue(undefined),
  },
  query: vi.fn(),
}));

vi.mock('@/lib/permissions', () => ({
  isAdmin: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/hash', () => ({
  hashEmail: vi.fn().mockReturnValue('hashed_email'),
  hashIP: vi.fn().mockReturnValue('hashed_ip'),
}));

vi.mock('@/lib/r2-storage', () => ({
  getSignedDownloadUrl: vi.fn().mockResolvedValue('https://r2.nzmarie.com/reports/Oteha/latest.pdf'),
}));

describe('PDF Manager & Report Download API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/admin/pdf/upload', () => {
    it('returns 403 if user is not admin', async () => {
      vi.mocked(auth).mockResolvedValueOnce(undefined as any);

      const request = new Request('http://localhost:3000/api/admin/pdf/upload', {
        method: 'POST',
      });

      const response = await uploadPOST(request);
      expect(response.status).toBe(403);
    });

    it('uploads PDF and saves record in suburb_reports', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      vi.mocked(marieDB.query).mockResolvedValueOnce({
        rows: [
          {
            id: 'report-1',
            suburb: 'Oteha',
            quarter: 'Q2',
            year: 2026,
            file_url: 'https://r2.nzmarie.com/reports/Oteha/Q2-2026.pdf',
          },
        ],
      } as any);

      const mockFile = new File(['dummy pdf content'], 'Oteha_Q2_2026.pdf', { type: 'application/pdf' });
      const mockFormData = new Map<string, unknown>([
        ['file', mockFile],
        ['suburb', 'Oteha'],
        ['quarter', 'Q2'],
        ['year', '2026'],
      ]);

      const request = {
        formData: vi.fn().mockResolvedValue({
          get: (key: string) => mockFormData.get(key),
        }),
      } as unknown as Request;

      const response = await uploadPOST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.report.suburb).toBe('Oteha');
    });
  });

  describe('GET /api/admin/pdf/reports', () => {
    it('returns report list for admin user', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        user: { email: 'nzlouis.com@gmail.com' },
      } as any);

      vi.mocked(marieDB.query).mockResolvedValueOnce({
        rows: [
          {
            id: 'report-1',
            suburb: 'Oteha',
            quarter: 'Q2',
            year: 2026,
            file_url: 'https://r2.nzmarie.com/reports/Oteha/Q2-2026.pdf',
          },
        ],
      } as any);

      const response = await reportsGET(new Request('http://localhost:3000/api/admin/pdf/reports'));
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.reports.length).toBe(1);
      expect(data.reports[0].suburb).toBe('Oteha');
    });
  });

  describe('POST /api/reports/download (Homepage download for Oteha)', () => {
    it('returns latest active PDF report from suburb_reports for Oteha', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce({ rows: [{ count: '0' }] } as any)
        .mockResolvedValueOnce({
          rows: [
            {
              id: 'report-1',
              file_url: 'https://r2.nzmarie.com/reports/Oteha/Q2-2026.pdf',
            },
          ],
        } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'event-1' }] } as any)
        .mockResolvedValueOnce({ rows: [] } as any)
        .mockResolvedValueOnce({ rows: [{ id: 'download-1' }] } as any);

      const request = new Request('http://localhost:3000/api/reports/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: 'John',
          email: 'john@example.com',
          suburb: 'Oteha',
        }),
      });

      const response = await downloadPOST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.downloadUrl).toBe('https://r2.nzmarie.com/reports/Oteha/Q2-2026.pdf');
    });
  });
});
