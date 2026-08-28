import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVisitorHash, generateUAHash, anonymizeIP, getClientIp, recordCampaignVisit, getCampaignStats, parseDeviceType } from '../../lib/campaign-tracker';
import * as db from '../../lib/db';

vi.mock('../../lib/db', () => ({
  query: vi.fn(),
  marieDB: {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] }),
  },
}));

describe('Campaign Tracker Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('anonymizeIP', () => {
    it('truncates IPv4 address last octet with xxx', () => {
      expect(anonymizeIP('192.168.1.100')).toBe('192.168.1.xxx');
      expect(anonymizeIP('203.0.113.195')).toBe('203.0.113.xxx');
    });

    it('masks IPv6 address last segments', () => {
      expect(anonymizeIP('2001:db8:85a3:8d3:1319:8a2e:370:7334')).toBe('2001:db8:85a3::xxx');
    });
  });

  describe('generateVisitorHash', () => {
    it('returns a 64 character sha256 hex string', () => {
      const hash = generateVisitorHash('192.168.1.1', 'Mozilla/5.0');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces identical hash for identical IP and User-Agent', () => {
      const hash1 = generateVisitorHash('10.0.0.1', 'iPhone');
      const hash2 = generateVisitorHash('10.0.0.1', 'iPhone');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different IPs', () => {
      const hash1 = generateVisitorHash('10.0.0.1', 'iPhone');
      const hash2 = generateVisitorHash('10.0.0.2', 'iPhone');
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('generateUAHash', () => {
    it('returns a 64 character sha256 hex string', () => {
      const hash = generateUAHash('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('produces the same hash regardless of IP address', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)';
      expect(generateUAHash(ua)).toBe(generateUAHash(ua));
    });

    it('differs from the ip+ua hash so legacy rows can be distinguished', () => {
      const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)';
      expect(generateUAHash(ua)).not.toBe(generateVisitorHash('1.2.3.4', ua));
    });
  });

  describe('getClientIp', () => {
    it('prefers the cf-connecting-ip header', () => {
      const req = new Request('https://nzmarie.com/torbay', {
        headers: {
          'cf-connecting-ip': '203.0.113.10',
          'x-forwarded-for': '198.51.100.5, 104.23.198.1',
        },
      });
      expect(getClientIp(req)).toBe('203.0.113.10');
    });

    it('falls back to the first x-forwarded-for entry', () => {
      const req = new Request('https://nzmarie.com/torbay', {
        headers: { 'x-forwarded-for': '198.51.100.5, 104.23.198.1' },
      });
      expect(getClientIp(req)).toBe('198.51.100.5');
    });

    it('falls back to x-real-ip when no other headers exist', () => {
      const req = new Request('https://nzmarie.com/torbay', {
        headers: { 'x-real-ip': '198.51.100.9' },
      });
      expect(getClientIp(req)).toBe('198.51.100.9');
    });

    it('returns a default value when no headers are present', () => {
      const req = new Request('https://nzmarie.com/torbay');
      expect(getClientIp(req)).toBe('127.0.0.1');
    });
  });

  describe('recordCampaignVisit', () => {
    it('executes database queries to record visit and update analytics', async () => {
      const queryMock = vi.mocked(db.query);
      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 0, global_cnt: 0, first_scanned_at: null }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({
        campaignKey: 'oteha',
        ip: '127.0.0.1',
        userAgent: 'TestBrowser',
      });

      expect(queryMock).toHaveBeenCalledTimes(3);
    });

    it('marks the first-ever scan as unique, anonymizes IP and visit_count 1', async () => {
      const queryMock = vi.mocked(db.query);
      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 0, global_cnt: 0, first_scanned_at: null }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({ campaignKey: 'torbay', ip: '203.0.113.10', userAgent: 'iPhone' });

      const insertCall = queryMock.mock.calls[1];
      const insertSql = insertCall[0] as string;
      const insertParams = insertCall[1] as unknown[];
      expect(insertSql).toContain('visit_count');
      expect(insertSql).toContain('first_scanned_at');
      expect(insertSql).toContain('is_new_device');
      expect(insertParams[2]).toBe('203.0.113.xxx');
      expect(insertParams[6]).toBe(true);
      expect(insertParams[7]).toBe(true);
      expect(insertParams[8]).toBe(1);
    });

    it('marks a repeat scan as repeat with incremented visit_count', async () => {
      const queryMock = vi.mocked(db.query);
      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 3, global_cnt: 5, first_scanned_at: '2026-07-01T00:00:00Z' }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({ campaignKey: 'torbay', ip: '203.0.113.10', userAgent: 'iPhone' });

      const insertCall = queryMock.mock.calls[1];
      const insertParams = insertCall[1] as unknown[];
      expect(insertParams[6]).toBe(false);
      expect(insertParams[7]).toBe(false);
      expect(insertParams[8]).toBe(4);
      expect(insertParams[9]).toBe('2026-07-01T00:00:00Z');
    });

    it('marks same UA with different IP as repeat (not new device)', async () => {
      const queryMock = vi.mocked(db.query);
      // global_cnt=3 means this UA has been seen before globally → not a new device
      // cnt=0 because a different IP was used (old ip+ua hash won't match uaHash)
      queryMock.mockResolvedValueOnce({ rows: [{ cnt: 0, global_cnt: 3, first_scanned_at: null }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({ campaignKey: 'torbay', ip: '2404:4408:930e:c400:b946:bfaa:8dbd:920f', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)' });

      const insertCall = queryMock.mock.calls[1];
      const insertParams = insertCall[1] as unknown[];
      expect(insertParams[7]).toBe(false);
    });

    it('prioritizes visitorId over ip-userAgent for the hash', async () => {
      const hashFromVisitor = generateVisitorHash('1.2.3.4', 'iPhone', 'abc123');
      const hashFromIp = generateVisitorHash('1.2.3.4', 'iPhone', undefined);
      expect(hashFromVisitor).not.toBe(hashFromIp);
      expect(hashFromVisitor).toBe(generateVisitorHash('9.9.9.9', 'Android', 'abc123'));
    });

    it('parses device type from user agent', () => {
      expect(parseDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)')).toBe('iOS');
      expect(parseDeviceType('Mozilla/5.0 (Linux; Android 13)')).toBe('Android');
      expect(parseDeviceType('Mozilla/5.0 (Macintosh; Intel Mac OS X)')).toBe('Desktop');
    });
  });

  describe('getCampaignStats', () => {
    it('returns stats record from database', async () => {
      const queryMock = vi.mocked(db.query);
      const mockStat = {
        campaign_key: 'oteha',
        campaign_name: 'Oteha Campaign',
        total_pv: 10,
        total_uv: 5,
        last_visited_at: '2026-07-23T10:00:00Z',
      };
      queryMock.mockResolvedValueOnce({ rows: [mockStat], rowCount: 1, command: '', oid: 0, fields: [] });

      const stats = await getCampaignStats('oteha');
      expect(stats).toEqual(mockStat);
    });

    it('returns null when campaign does not exist', async () => {
      const queryMock = vi.mocked(db.query);
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      const stats = await getCampaignStats('unknown');
      expect(stats).toBeNull();
    });
  });
});
