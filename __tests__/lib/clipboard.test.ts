import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildFullAddress, buildPropertyAddress, copyText } from '@/lib/clipboard';

describe('buildFullAddress', () => {
  it('joins non-empty parts with comma', () => {
    expect(buildFullAddress(['4 Cairnbrae Court', 'Northcross', 'Auckland', 'Auckland', '0632'])).toBe(
      '4 Cairnbrae Court, Northcross, Auckland, Auckland, 0632',
    );
  });

  it('filters empty, null and whitespace-only parts', () => {
    expect(buildFullAddress(['  ', null, undefined, 'Northcross', '', 'Auckland'])).toBe('Northcross, Auckland');
  });

  it('trims whitespace', () => {
    expect(buildFullAddress(['  4 Cairnbrae Court ', ' Northcross '])).toBe('4 Cairnbrae Court, Northcross');
  });

  it('returns empty string when all parts empty', () => {
    expect(buildFullAddress(['', null, undefined])).toBe('');
  });
});

describe('buildPropertyAddress', () => {
  it('builds full address from property fields', () => {
    expect(buildPropertyAddress('4 Cairnbrae Court', 'Northcross', 'North Shore City', 'Auckland', '0632')).toBe(
      '4 Cairnbrae Court, Northcross, North Shore City, Auckland, 0632',
    );
  });

  it('omits missing optional fields', () => {
    expect(buildPropertyAddress('4 Cairnbrae Court', 'Northcross', null, undefined)).toBe(
      '4 Cairnbrae Court, Northcross',
    );
  });

  it('handles null address gracefully', () => {
    expect(buildPropertyAddress(null, 'Northcross', 'Auckland')).toBe('Northcross, Auckland');
  });
});

describe('copyText', () => {
  const originalClipboard = (global.navigator as unknown as { clipboard?: unknown })?.clipboard;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // restore clipboard
    if (originalClipboard) {
      Object.defineProperty(global.navigator, 'clipboard', { value: originalClipboard, configurable: true });
    } else {
      delete (global.navigator as unknown as { clipboard?: unknown }).clipboard;
    }
    vi.restoreAllMocks();
  });

  it('returns false for empty string', async () => {
    expect(await copyText('')).toBe(false);
  });

  it('uses navigator.clipboard when available and returns true on success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const ok = await copyText('4 Cairnbrae Court, Northcross, Auckland');
    expect(writeText).toHaveBeenCalledWith('4 Cairnbrae Court, Northcross, Auckland');
    expect(ok).toBe(true);
  });

  it('falls back to execCommand when clipboard API fails', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    const execCommand = vi.fn().mockReturnValue(true);
    (document as unknown as { execCommand: typeof document.execCommand }).execCommand = execCommand as unknown as typeof document.execCommand;

    const ok = await copyText('fallback address');

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(ok).toBe(true);
  });

  it('returns false when both clipboard and execCommand fail', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });
    (document as unknown as { execCommand: typeof document.execCommand }).execCommand = vi.fn().mockImplementation(() => {
      throw new Error('no exec');
    }) as unknown as typeof document.execCommand;

    const ok = await copyText('fail case');
    expect(ok).toBe(false);
  });

  it('uses execCommand path when navigator.clipboard is absent', async () => {
    delete (global.navigator as unknown as { clipboard?: unknown }).clipboard;
    (document as unknown as { execCommand: typeof document.execCommand }).execCommand = vi.fn().mockReturnValue(true) as unknown as typeof document.execCommand;

    const ok = await copyText('no clipboard address');
    expect(ok).toBe(true);
  });

  it('returns false when execCommand returns false', async () => {
    delete (global.navigator as unknown as { clipboard?: unknown }).clipboard;
    (document as unknown as { execCommand: typeof document.execCommand }).execCommand = vi.fn().mockReturnValue(false) as unknown as typeof document.execCommand;

    const ok = await copyText('exec returns false');
    expect(ok).toBe(false);
  });
});
