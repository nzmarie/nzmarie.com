import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateVisitorHash, anonymizeIP, recordCampaignVisit, getCampaignStats } from '../../lib/campaign-tracker';
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

  describe('recordCampaignVisit', () => {
    it('executes database queries to record visit and update analytics', async () => {
      const queryMock = vi.mocked(db.query);
      queryMock.mockResolvedValueOnce({ rows: [{ count: '0' }], rowCount: 1, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });
      queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0, command: '', oid: 0, fields: [] });

      await recordCampaignVisit({
        campaignKey: 'oteha',
        ip: '127.0.0.1',
        userAgent: 'TestBrowser',
      });

      expect(queryMock).toHaveBeenCalledTimes(3);
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
