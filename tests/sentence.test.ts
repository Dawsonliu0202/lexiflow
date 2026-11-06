import { describe, it, expect } from 'vitest';
import { extractSentenceFromText } from '../entrypoints/content/sentence';

describe('Sentence Extraction (extractSentenceFromText)', () => {
  it('extracts a normal English sentence ending with a period', () => {
    const text = 'Rising prices place a heavy burden on low-income families. Economists warn about inflation.';
    const start = text.indexOf('burden');
    const end = start + 'burden'.length;

    const sentence = extractSentenceFromText(text, start, end);
    expect(sentence).toBe('Rising prices place a heavy burden on low-income families.');
  });

  it('handles abbreviations like e.g., Mr., Dr., U.S. without breaking early', () => {
    const text = 'The governor spoke with Dr. Smith and Mr. Brown regarding the U.S. economic policy. It was successful.';
    const start = text.indexOf('economic');
    const end = start + 'economic'.length;

    const sentence = extractSentenceFromText(text, start, end);
    expect(sentence).toBe('The governor spoke with Dr. Smith and Mr. Brown regarding the U.S. economic policy.');
  });

  it('does not split on decimal points like 3.14 or $1.5 billion', () => {
    const text = 'The company reported a 3.14 percent growth and $1.5 billion in revenue. This exceeded expectations.';
    const start = text.indexOf('billion');
    const end = start + 'billion'.length;

    const sentence = extractSentenceFromText(text, start, end);
    expect(sentence).toBe('The company reported a 3.14 percent growth and $1.5 billion in revenue.');
  });

  it('handles Chinese punctuation correctly (treating semicolons and full stops as boundaries)', () => {
    // Semicolon boundary (per PRD 2.1)
    const textWithSemicolon = '通胀正在加剧。低收入群体面临巨大负担；我们需要立即行动！下周将举行听证会。';
    const start1 = textWithSemicolon.indexOf('负担');
    const end1 = start1 + '负担'.length;

    const sentence1 = extractSentenceFromText(textWithSemicolon, start1, end1);
    expect(sentence1).toBe('低收入群体面临巨大负担；');

    // Comma inside sentence, bounded by full stop and exclamation mark
    const textWithComma = '通胀正在加剧。低收入群体面临巨大负担，我们需要立即行动！下周将举行听证会。';
    const start2 = textWithComma.indexOf('负担');
    const end2 = start2 + '负担'.length;

    const sentence2 = extractSentenceFromText(textWithComma, start2, end2);
    expect(sentence2).toBe('低收入群体面临巨大负担，我们需要立即行动！');
  });

  it('truncates very long paragraphs exceeding 400 characters around the target word', () => {
    const prefix = 'A'.repeat(300);
    const suffix = 'B'.repeat(300);
    const text = `${prefix} important_word ${suffix}.`;
    const start = text.indexOf('important_word');
    const end = start + 'important_word'.length;

    const sentence = extractSentenceFromText(text, start, end, { maxLength: 400 });
    expect(sentence.length).toBeLessThanOrEqual(405);
    expect(sentence).toContain('important_word');
    expect(sentence.startsWith('…')).toBe(true);
    expect(sentence.endsWith('…')).toBe(true);
  });
});
