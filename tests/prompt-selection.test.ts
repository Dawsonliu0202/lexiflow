import { describe, it, expect } from 'vitest';
import { detectSelectionType } from '../entrypoints/content/selection';
import { buildMessages } from '../services/ai/prompt';
import type { AiConfig } from '../shared/types';

describe('Selection Type Detection & Prompt Generation', () => {
  const dummyConfig: AiConfig = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: 'sk-test',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    targetLang: '简体中文',
  };

  it('classifies single words accurately', () => {
    expect(detectSelectionType('credentials')).toBe('word');
    expect(detectSelectionType(' state-of-the-art ')).toBe('word');
    expect(detectSelectionType('"sovereignty"')).toBe('word');
    expect(detectSelectionType('alleviate,')).toBe('word');
  });

  it('classifies short phrases accurately', () => {
    expect(detectSelectionType('look forward to')).toBe('phrase');
    expect(detectSelectionType('by water as well as by land')).toBe('phrase');
    expect(detectSelectionType('artificial intelligence')).toBe('phrase');
  });

  it('classifies sentences and multi-line paragraphs accurately', () => {
    expect(
      detectSelectionType(
        'Continually moving southward, the settlers eventually populated both North and South America.'
      )
    ).toBe('sentence');

    expect(
      detectSelectionType(
        'First paragraph content here.\nSecond paragraph content follows.'
      )
    ).toBe('sentence');
  });

  it('builds word-mode prompt with dictionary schema', () => {
    const msgs = buildMessages(
      {
        word: 'credential',
        sentence: 'He showed his credential to enter.',
        pageTitle: 'Test Page',
        pageUrl: 'https://example.com',
      },
      dummyConfig
    );

    expect(msgs[0].content).toContain('语境词典专家');
    expect(msgs[0].content).toContain('coreMeanings');
    expect(msgs[1].content).toContain('"word":"credential"');
  });

  it('builds phrase-mode prompt for short phrases', () => {
    const msgs = buildMessages(
      {
        word: 'look forward to',
        sentence: 'We look forward to hearing from you.',
        pageTitle: 'Test Page',
        pageUrl: 'https://example.com',
      },
      dummyConfig
    );

    expect(msgs[0].content).toContain('短语或固定搭配');
  });

  it('builds passage-mode prompt for full sentences or paragraphs', () => {
    const paragraph =
      'Continually moving southward, the settlers eventually populated both North and South America, creating unique cultures.';
    const msgs = buildMessages(
      {
        word: paragraph,
        sentence: paragraph,
        pageTitle: 'History Page',
        pageUrl: 'https://example.com',
      },
      dummyConfig
    );

    expect(msgs[0].content).toContain('句子或段落');
    expect(msgs[0].content).toContain('translation');
    expect(msgs[0].content).not.toContain('coreMeanings');
  });
});
