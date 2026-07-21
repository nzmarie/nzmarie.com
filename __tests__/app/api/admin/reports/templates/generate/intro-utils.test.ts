import { describe, it, expect } from 'vitest';
import { extractDaysToSellDescription, filterOutDaysToSellFromIntro } from '../../../../../../../app/api/admin/reports/templates/generate/intro-utils';

describe('extractDaysToSellDescription', () => {
  it('returns null for null input', () => {
    expect(extractDaysToSellDescription(null)).toBeNull();
  });

  it('returns null for empty array', () => {
    expect(extractDaysToSellDescription([])).toBeNull();
  });

  it('extracts paragraph with text object content format', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Days to Sell', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.', styles: {} }] },
    ];
    expect(extractDaysToSellDescription(blocks)).toBe('The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.');
  });

  it('extracts paragraph with old string array content format', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: ['Days to Sell'] },
      { type: 'paragraph', content: ['The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.'] },
    ];
    expect(extractDaysToSellDescription(blocks)).toBe('The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.');
  });

  it('extracts paragraph with plain string content', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: 'Days to Sell' },
      { type: 'paragraph', content: 'The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.' },
    ];
    expect(extractDaysToSellDescription(blocks)).toBe('The average Days to Sell of 28 days during 2026 Q2 reflects current market liquidity.');
  });

  it('extracts paragraph with lowercase casing', () => {
    const blocks = [
      { type: 'heading', content: [{ type: 'text', text: 'Days to sell', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'the average days to sell of 28 days during 2026 Q2.', styles: {} }] },
    ];
    expect(extractDaysToSellDescription(blocks)).toBe('the average days to sell of 28 days during 2026 Q2.');
  });

  it('returns null if no paragraph matches', () => {
    const blocks = [
      { type: 'paragraph', content: [{ type: 'text', text: 'Another paragraph', styles: {} }] },
    ];
    expect(extractDaysToSellDescription(blocks)).toBeNull();
  });

  it('skips non-paragraph blocks', () => {
    const blocks = [
      { type: 'heading', content: [{ type: 'text', text: 'The average Days to Sell is 28 days', styles: {} }] },
    ];
    expect(extractDaysToSellDescription(blocks)).toBeNull();
  });

  it('handles content as undefined', () => {
    const blocks = [
      { type: 'paragraph' },
    ];
    expect(extractDaysToSellDescription(blocks)).toBeNull();
  });

  it('handles mixed content types in array where first item is different', () => {
    const blocks = [
      { type: 'paragraph', content: ['Some leading text. ', { type: 'text', text: 'The average Days to Sell of 28 days.', styles: {} }] },
    ];
    // regex requires text to START with "the average days to sell" (case-insensitive)
    expect(extractDaysToSellDescription(blocks)).toBeNull();
  });
});

describe('filterOutDaysToSellFromIntro', () => {
  it('returns null for null input', () => {
    expect(filterOutDaysToSellFromIntro(null)).toBeNull();
  });

  it('returns empty array for empty input', () => {
    expect(filterOutDaysToSellFromIntro([])).toEqual([]);
  });

  it('removes heading with string content containing Days to Sell', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: 'Days to Sell' },
      { type: 'paragraph', content: 'The average Days to Sell of 28 days.' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('removes heading with object array content containing Days to Sell', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Days to Sell', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The average Days to Sell of 28 days.', styles: {} }] },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('removes heading with old string array content containing Days to Sell', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: ['Days to Sell'] },
      { type: 'paragraph', content: ['The average Days to Sell of 28 days.'] },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('removes blocks with lowercase "days to sell"', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: 'Days to sell' },
      { type: 'paragraph', content: 'the average days to sell of 28 days.' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('removes blocks with mixed case "dAys tO sEll"', () => {
    const blocks = [
      { type: 'heading', content: [{ type: 'text', text: 'DAYS TO SELL', styles: {} }] },
      { type: 'paragraph', content: 'The average Days to Sell of 28 days.' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('keeps unrelated blocks', () => {
    const blocks = [
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Oteha', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'This is a new Oteha introduction.', styles: {} }] },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual(blocks);
  });

  it('strips Days to Sell but keeps other blocks', () => {
    const blocks = [
      { type: 'heading', props: { level: 1 }, content: [{ type: 'text', text: 'Oteha', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Some intro text.', styles: {} }] },
      { type: 'heading', props: { level: 3 }, content: 'Days to Sell' },
      { type: 'paragraph', content: 'The average Days to Sell of 28 days.' },
      { type: 'paragraph', content: [{ type: 'text', text: 'More text after.', styles: {} }] },
    ];
    const result = filterOutDaysToSellFromIntro(blocks);
    expect(result).toHaveLength(3);
    expect((result as any[])?.[0]?.content?.[0]?.text || (result as any[])?.[0]?.content?.[0]).toBe('Oteha');
    expect((result as any[])?.[2]?.content?.[0]?.text || (result as any[])?.[2]?.content?.[0]).toBe('More text after.');
  });

  it('removes preceding heading when paragraph with Days to Sell is found', () => {
    const blocks = [
      { type: 'heading', props: { level: 2 }, content: [{ type: 'text', text: 'Market Insights', styles: {} }] },
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Days to Sell', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The average Days to Sell of 28 days reflects current market liquidity.', styles: {} }] },
    ];
    const result = filterOutDaysToSellFromIntro(blocks);
    expect(result).toHaveLength(1);
    expect((result as any[])?.[0]?.content?.[0]?.text || (result as any[])?.[0]?.content?.[0]).toBe('Market Insights');
  });

  it('handles undefined content gracefully', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 } },
      { type: 'paragraph' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toHaveLength(2);
  });

  it('removes heading only (no matching paragraph)', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: 'Days to Sell Analysis' },
      { type: 'paragraph', content: 'Some other text about the market.' },
    ];
    const result = filterOutDaysToSellFromIntro(blocks);
    expect(result).toHaveLength(1);
    const remaining = (result as any[])?.[0];
    expect(remaining.type).toBe('paragraph');
    expect(remaining.content).toBe('Some other text about the market.');
  });

  it('handles mixed content types across blocks', () => {
    const blocks = [
      { type: 'heading', props: { level: 1 }, content: 'Oteha' },
      { type: 'paragraph', content: 'Intro paragraph.' },
      { type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Days to Sell', styles: {} }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'The average Days to Sell of 28 days.', styles: {} }] },
    ];
    const result = filterOutDaysToSellFromIntro(blocks);
    expect(result).toHaveLength(2);
  });

  it('processes Oteha the same as any other suburb', () => {
    const blocks = [
      { type: 'heading', props: { level: 3 }, content: 'Days to Sell' },
      { type: 'paragraph', content: 'The average Days to Sell of 28 days.' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });

  it('removes paragraph with "Average days to sell" (lowercase), not just "The average"', () => {
    const blocks = [
      { type: 'heading', content: 'Days to Sell' },
      { type: 'paragraph', content: 'Average days to sell: 28 days.' },
    ];
    expect(filterOutDaysToSellFromIntro(blocks)).toEqual([]);
  });
});
