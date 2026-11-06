import { z } from 'zod';
import type { AiWordEntry } from '../../shared/types';
import { LexiFlowError } from '../../shared/errors';
import { normalizeLemma } from './normalize';

const aiWordEntrySchema = z.object({
  word: z.string().default(''),
  lemma: z.string().min(1, 'lemma 不能为空'),
  phonetic: z.string().optional().default(''),
  contextMeaning: z.string().min(1, 'contextMeaning 不能为空'),
  coreMeanings: z
    .array(z.string())
    .optional()
    .default([])
    .transform((list) => list.slice(0, 3)),
  analysis: z.string().optional().default(''),
});

/**
 * Attempts to extract fields from an incomplete, streaming JSON string.
 */
export function partialParse(text: string): Partial<AiWordEntry> {
  const result: Partial<AiWordEntry> = {};
  if (!text) return result;

  // 1. Try direct JSON.parse in case it's already complete
  try {
    const raw = JSON.parse(text);
    if (typeof raw === 'object' && raw !== null) {
      if (typeof raw.word === 'string') result.word = raw.word;
      if (typeof raw.lemma === 'string') result.lemma = normalizeLemma(raw.lemma);
      if (typeof raw.phonetic === 'string') result.phonetic = raw.phonetic;
      if (typeof raw.contextMeaning === 'string') result.contextMeaning = raw.contextMeaning;
      if (Array.isArray(raw.coreMeanings)) {
        result.coreMeanings = raw.coreMeanings.filter((x: unknown) => typeof x === 'string');
      }
      if (typeof raw.analysis === 'string') result.analysis = raw.analysis;
      return result;
    }
  } catch {
    // Continue with regex-based lenient extraction
  }

  // 2. Extract string fields with completed or in-progress quotes
  const extractString = (key: string): string | undefined => {
    // Match closed: "key": "value"
    const closedRegex = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`);
    const closedMatch = text.match(closedRegex);
    if (closedMatch) {
      try {
        return JSON.parse(`"${closedMatch[1]}"`);
      } catch {
        return closedMatch[1];
      }
    }

    // Match in-progress unclosed: "key": "value...
    const unclosedRegex = new RegExp(`"${key}"\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)$`);
    const unclosedMatch = text.match(unclosedRegex);
    if (unclosedMatch) {
      return unclosedMatch[1];
    }
    return undefined;
  };

  const word = extractString('word');
  if (word !== undefined) result.word = word;

  const lemma = extractString('lemma');
  if (lemma !== undefined) result.lemma = normalizeLemma(lemma);

  const phonetic = extractString('phonetic');
  if (phonetic !== undefined) result.phonetic = phonetic;

  const contextMeaning = extractString('contextMeaning');
  if (contextMeaning !== undefined) result.contextMeaning = contextMeaning;

  const analysis = extractString('analysis');
  if (analysis !== undefined) result.analysis = analysis;

  // Extract coreMeanings array
  const arrayMatch = text.match(/"coreMeanings"\s*:\s*\[([\s\S]*?)(\]|$)/);
  if (arrayMatch) {
    const items: string[] = [];
    const itemRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
    let m: RegExpExecArray | null;
    while ((m = itemRegex.exec(arrayMatch[1])) !== null) {
      try {
        items.push(JSON.parse(`"${m[1]}"`));
      } catch {
        items.push(m[1]);
      }
    }
    if (items.length > 0) {
      result.coreMeanings = items.slice(0, 3);
    }
  }

  return result;
}

/**
 * Validates and finalizes the complete AI response text into an AiWordEntry.
 */
export function finalizeEntry(text: string, fallbackWord?: string): AiWordEntry {
  let cleaned = text.trim();

  // Strip markdown code fences if wrapped in ```json ... ```
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // Find the first JSON object block {...}
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch (err) {
    throw new LexiFlowError(
      'AI_PARSE_ERROR',
      `无法解析 AI 返回的 JSON: ${(err as Error).message}`,
      false,
      { raw: text }
    );
  }

  const result = aiWordEntrySchema.safeParse(parsedJson);
  if (!result.success) {
    throw new LexiFlowError(
      'AI_PARSE_ERROR',
      `AI 返回的字段格式不符合规范: ${result.error.errors.map((e) => e.message).join('; ')}`,
      false,
      { raw: text, issues: result.error.issues }
    );
  }

  const data = result.data;
  const word = data.word.trim() || fallbackWord?.trim() || data.lemma.trim();
  const lemma = normalizeLemma(data.lemma) || normalizeLemma(word);

  return {
    word,
    lemma,
    phonetic: data.phonetic.trim(),
    contextMeaning: data.contextMeaning.trim(),
    coreMeanings: data.coreMeanings.map((m) => m.trim()),
    analysis: data.analysis.trim().slice(0, 200),
  };
}
