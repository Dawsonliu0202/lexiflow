const ABBREVIATION_REGEX = /(?:^|\s|[.(])(e\.g|i\.e|etc|Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|U\.S)\.$/i;

export interface ExtractSentenceOptions {
  maxLength?: number;
}

/**
 * Pure function to extract the enclosing sentence from block text and character range.
 */
export function extractSentenceFromText(
  fullText: string,
  start: number,
  end: number,
  options: ExtractSentenceOptions = {}
): string {
  const maxLength = options.maxLength ?? 400;

  if (!fullText) return '';
  if (start < 0) start = 0;
  if (end > fullText.length) end = fullText.length;
  if (start > end) start = end;

  const isSentenceEnd = (i: number): boolean => {
    const ch = fullText[i];
    if (!/[.!?。！？;；\n\r]/.test(ch)) return false;

    // Disregard periods that are part of abbreviations, acronyms, or numbers
    if (ch === '.') {
      const nextChar = fullText[i + 1] || '';
      // If dot is immediately followed by a letter or number (e.g. U.S., 3.14), it's not sentence end
      if (/[a-zA-Z0-9]/.test(nextChar)) {
        return false;
      }

      // Check abbreviation whitelist
      const precedingSlice = fullText.slice(Math.max(0, i - 8), i + 1);
      if (ABBREVIATION_REGEX.test(precedingSlice)) {
        return false;
      }

      // Single initial e.g. "Dr. J. Smith"
      if (/(?:^|\s)[A-Z]\.$/.test(precedingSlice)) {
        return false;
      }

      // Check decimal number preceding
      const prevChar = fullText[i - 1] || '';
      if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
        return false;
      }
    }
    return true;
  };

  // Expand leftwards
  let a = start;
  while (a > 0 && !isSentenceEnd(a - 1)) {
    a--;
  }

  // Expand rightwards
  let b = end;
  while (b < fullText.length && !isSentenceEnd(b)) {
    b++;
  }

  // Include the punctuation at boundary if present
  let sentence = fullText.slice(a, Math.min(b + 1, fullText.length)).trim();

  // If sentence length exceeds maxLength (default 400), center around selection
  if (sentence.length > maxLength) {
    const center = Math.floor((start + end) / 2);
    const half = Math.floor(maxLength / 2);
    const sliceStart = Math.max(0, center - half);
    const sliceEnd = Math.min(fullText.length, center + half);
    sentence = '…' + fullText.slice(sliceStart, sliceEnd).trim() + '…';
  }

  return sentence;
}

/**
 * Extracts the enclosing sentence from a DOM Range.
 */
export function extractSentenceFromRange(range: Range): string {
  const container = range.startContainer;
  const parent = container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;

  if (!parent) {
    return range.toString().trim();
  }

  const block =
    parent.closest('p, li, h1, h2, h3, h4, h5, h6, blockquote, td, div') || parent;
  const fullText = block.textContent || '';

  try {
    const preRange = document.createRange();
    preRange.selectNodeContents(block);
    preRange.setEnd(range.startContainer, range.startOffset);

    const start = preRange.toString().length;
    const end = start + range.toString().length;

    return extractSentenceFromText(fullText, start, end);
  } catch {
    return range.toString().trim();
  }
}
