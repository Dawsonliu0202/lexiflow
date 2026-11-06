import { describe, it, expect } from 'vitest';
import { partialParse, finalizeEntry } from '../services/ai/parse';

describe('AI JSON Parsing & Validation', () => {
  it('parses in-progress streaming JSON chunk (partialParse)', () => {
    const chunk = '{"word": "burden", "lemma": "burden", "phonetic": "/ˈbɜːrdn/", "contextMeaning": "（经济上的）重担';
    const parsed = partialParse(chunk);

    expect(parsed.word).toBe('burden');
    expect(parsed.lemma).toBe('burden');
    expect(parsed.phonetic).toBe('/ˈbɜːrdn/');
    expect(parsed.contextMeaning).toBe('（经济上的）重担');
  });

  it('finalizes a well-formed JSON string into AiWordEntry', () => {
    const jsonStr = JSON.stringify({
      word: 'burden',
      lemma: 'burden',
      phonetic: '/ˈbɜːrdn/',
      contextMeaning: '负担',
      coreMeanings: ['n. 重担', 'v. 加重负荷'],
      analysis: '语境指通胀造成的经济重担。',
    });

    const entry = finalizeEntry(jsonStr);
    expect(entry.word).toBe('burden');
    expect(entry.lemma).toBe('burden');
    expect(entry.contextMeaning).toBe('负担');
    expect(entry.coreMeanings).toHaveLength(2);
    expect(entry.analysis).toContain('经济重担');
  });

  it('strips markdown code blocks (```json ... ```)', () => {
    const wrapped = `
\`\`\`json
{
  "word": "alleviate",
  "lemma": "alleviate",
  "phonetic": "/əˈliːvieɪt/",
  "contextMeaning": "缓解",
  "coreMeanings": ["v. 减轻，缓和"],
  "analysis": "常搭配 pressure 或 pain。"
}
\`\`\`
    `.trim();

    const entry = finalizeEntry(wrapped);
    expect(entry.lemma).toBe('alleviate');
    expect(entry.contextMeaning).toBe('缓解');
  });

  it('normalizes lemma to lowercase', () => {
    const jsonStr = JSON.stringify({
      word: 'Burdened',
      lemma: 'BURDEN',
      contextMeaning: '负重',
    });

    const entry = finalizeEntry(jsonStr);
    expect(entry.lemma).toBe('burden');
  });

  it('throws AI_PARSE_ERROR when required fields like lemma or contextMeaning are missing', () => {
    const invalidJson = JSON.stringify({
      // completely empty without fallback
    });

    expect(() => finalizeEntry(invalidJson)).toThrow();
  });

  it('finalizes a passage translation JSON with translation field into AiWordEntry', () => {
    const jsonStr = JSON.stringify({
      translation: '持续向南迁移，定居者最终遍布北美和南美。',
      analysis: '定语从句结构与历史语境。',
    });

    const entry = finalizeEntry(
      jsonStr,
      'Continually moving southward, the settlers eventually populated both North and South America.'
    );
    expect(entry.contextMeaning).toBe('持续向南迁移，定居者最终遍布北美和南美。');
    expect(entry.word).toContain('Continually moving southward');
    expect(entry.mode).toBe('sentence');
    expect(entry.analysis).toBe('定语从句结构与历史语境。');
  });

  it('partially parses streaming passage translation', () => {
    const chunk = '{"translation": "持续向南迁移，定居者最终';
    const parsed = partialParse(chunk);
    expect(parsed.contextMeaning).toBe('持续向南迁移，定居者最终');
  });
});
