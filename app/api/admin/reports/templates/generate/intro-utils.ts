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

  let foundHeader = false;
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i] as any;
    const blockText = getContentText(block.content);
    if (!blockText) continue;

    if (foundHeader && block.type === 'paragraph') {
      return blockText;
    }

    if (block.type === 'heading' && textContainsDaysToSell(blockText)) {
      foundHeader = true;
      continue;
    }

    if (block.type === 'paragraph' && textContainsDaysToSell(blockText)) {
      if (/^the\s+average\s+days?\s*to\s*sell/i.test(blockText)) {
        return blockText;
      }
      foundHeader = true;
      continue;
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
