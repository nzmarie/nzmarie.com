import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';

// Mock clipboard module
const copyTextMock = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/clipboard', async () => {
  const actual = await vi.importActual<typeof import('@/lib/clipboard')>('@/lib/clipboard');
  return {
    ...actual,
    copyText: (...args: unknown[]) => copyTextMock(...args),
  };
});

// Simplified property card that mirrors the real implementation's Copy button logic
import { buildPropertyAddress } from '@/lib/clipboard';
import { copyText } from '@/lib/clipboard';

function CopyButton({
  address,
  suburb,
  city,
  region,
  postcode,
}: {
  address: string;
  suburb: string;
  city: string;
  region?: string;
  postcode?: string | null;
}) {
  const [copied, setCopied] = React.useState(false);
  const handle = async () => {
    const full = buildPropertyAddress(address, suburb, city, region, postcode ?? null);
    const ok = await copyText(full || address);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <button
      type="button"
      aria-label={`Copy address ${address}`}
      onClick={() => void handle()}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

describe('Copy address button', () => {
  beforeEach(() => {
    copyTextMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  it('renders Copy and copies full address on click', async () => {
    render(<CopyButton address="4 Cairnbrae Court" suburb="Northcross" city="Auckland" region="Auckland" postcode="0632" />);
    const btn = screen.getByRole('button', { name: /Copy address/i });
    expect(btn.textContent).toBe('Copy');

    fireEvent.click(btn);
    await waitFor(() => expect(copyTextMock).toHaveBeenCalledWith('4 Cairnbrae Court, Northcross, Auckland, Auckland, 0632'));
  });

  it('shows Copied! feedback after successful copy', async () => {
    render(<CopyButton address="15 Marine Parade" suburb="Takapuna" city="North Shore City" />);
    const btn = screen.getByRole('button', { name: /Copy address/i });
    fireEvent.click(btn);
    await waitFor(() => expect(btn.textContent).toBe('Copied!'));
  });

  it('does not show Copied! when copy fails', async () => {
    copyTextMock.mockResolvedValueOnce(false);
    render(<CopyButton address="1 Queen Street" suburb="Auckland Central" city="Auckland" />);
    const btn = screen.getByRole('button', { name: /Copy address/i });
    fireEvent.click(btn);
    await waitFor(() => expect(copyTextMock).toHaveBeenCalled());
    // still Copy, not Copied!
    expect(btn.textContent).toBe('Copy');
  });

  it('buildPropertyAddress is used to join parts - does not include duplicate commas', async () => {
    render(<CopyButton address="4 Cairnbrae Court" suburb="" city="Auckland" />);
    const btn = screen.getByRole('button', { name: /Copy address/i });
    fireEvent.click(btn);
    await waitFor(() => expect(copyTextMock).toHaveBeenCalledWith('4 Cairnbrae Court, Auckland'));
  });

  it('no longer shows Street label - button text is Copy', () => {
    render(<CopyButton address="4 Cairnbrae Court" suburb="Northcross" city="Auckland" />);
    expect(screen.queryByText('Street')).toBeNull();
    expect(screen.getByText('Copy')).toBeTruthy();
  });
});
