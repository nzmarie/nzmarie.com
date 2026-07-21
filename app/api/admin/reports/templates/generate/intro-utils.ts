/* eslint-disable @typescript-eslint/no-explicit-any */

function getContentText(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((c: any) => (typeof c === 'string' ? c : c?.text || ''))
      .join('')
      .trim();
  }
  return '';
}

function textContainsDaysToSell(text: string): boolean {
  return /days?\s*to\s*sell/i.test(text);
}

function rawContainsDaysToSell(block: any): boolean {
  if (!block) return false;
  const text = getContentText(block.content);
  if (textContainsDaysToSell(text)) return true;
  if (block.props && typeof block.props === 'object') {
    for (const val of Object.values(block.props)) {
      if (typeof val === 'string' && textContainsDaysToSell(val)) return true;
    }
  }
  return false;
}

export function extractDaysToSellDescription(blocks: unknown[] | null): string | null {
  if (!Array.isArray(blocks)) return null;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as any;
    if (block.type === 'paragraph') {
      const blockText = getContentText(block.content);
      if (/^the\s+average\s+days?\s*to\s*sell/i.test(blockText)) {
        return blockText;
      }
    }
  }

  return null;
}

export function filterOutDaysToSellFromIntro(blocks: unknown[] | null): unknown[] | null {
  if (!Array.isArray(blocks)) return blocks;

  const out: unknown[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as any;

    if (rawContainsDaysToSell(block)) {
      continue;
    }

    out.push(block);
  }

  return out;
}
