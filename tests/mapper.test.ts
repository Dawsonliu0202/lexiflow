import { describe, it, expect } from 'vitest';
import {
  toDatabaseProperties,
  toContextBulletBlock,
  chunkBlocks,
} from '../services/notion/mapper';
import type { Word, WordContext } from '../shared/types';

describe('Notion Mapper (services/notion/mapper)', () => {
  const sampleWord: Word = {
    lemma: 'burden',
    word: 'burden',
    phonetic: '/ˈbɜːrdn/',
    contextMeaning: '重担',
    coreMeanings: ['n. 重担', 'v. 加重负荷'],
    analysis: '指经济重担。',
    count: 2,
    contexts: [
      {
        id: 'ctx-1',
        sentence: 'Prices place a heavy burden.',
        contextMeaning: '重担',
        pageTitle: 'News Article',
        pageUrl: 'https://news.example.com',
        capturedAt: Date.now(),
      },
    ],
    firstSeenAt: Date.now(),
    updatedAt: Date.now(),
    syncStatus: 'pending',
    rev: 1,
    unsyncedDelta: 1,
    unsyncedContextIds: ['ctx-1'],
    retryCount: 0,
    nextRetryAt: 0,
  };

  it('maps Word to Notion properties in create mode (includes title and initial properties)', () => {
    const props = toDatabaseProperties(sampleWord, 'create');
    expect(props['Lemma']).toBeDefined();
    expect(props['Word']).toBeDefined();
    expect(props['Count']).toEqual({ number: 2 });
    expect(props['Status']).toEqual({ select: { name: 'New' } });
  });

  it('maps Word to Notion properties in update mode (does not overwrite title or First Seen)', () => {
    const props = toDatabaseProperties(sampleWord, 'update', 5);
    expect(props['Lemma']).toBeUndefined();
    expect(props['First Seen']).toBeUndefined();
    expect(props['Count']).toEqual({ number: 5 });
    expect(props['Meaning']).toBeDefined();
  });

  it('truncates rich text longer than 2000 characters', () => {
    const longSentence = 'A'.repeat(3000);
    const wordWithLongContext: Word = {
      ...sampleWord,
      contexts: [
        {
          id: 'ctx-long',
          sentence: longSentence,
          contextMeaning: '释义',
          pageTitle: 'Title',
          pageUrl: 'https://example.com',
          capturedAt: Date.now(),
        },
      ],
    };

    const props = toDatabaseProperties(wordWithLongContext, 'update');
    const latestContextProp = props['Latest Context'] as {
      rich_text: Array<{ text: { content: string } }>;
    };
    expect(latestContextProp.rich_text[0].text.content.length).toBeLessThanOrEqual(2000);
  });

  it('maps WordContext to bulleted_list_item block with embedded link', () => {
    const ctx: WordContext = {
      id: 'c1',
      sentence: 'This is a test sentence.',
      contextMeaning: '测试释义',
      pageTitle: 'Test Page',
      pageUrl: 'https://example.com/page',
      capturedAt: Date.now(),
    };

    const block = toContextBulletBlock(ctx);
    expect(block.object).toBe('block');
    expect(block.type).toBe('bulleted_list_item');

    const rt = (block.bulleted_list_item as { rich_text: Array<Record<string, unknown>> }).rich_text;
    expect(rt.length).toBeGreaterThanOrEqual(2);
    expect(rt[0].text).toEqual({ content: '“This is a test sentence.” — ' });
  });

  it('chunks blocks into batches of at most 100', () => {
    const blocks = Array.from({ length: 250 }, (_, i) => ({ id: i }));
    const chunks = chunkBlocks(blocks, 100);

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(100);
    expect(chunks[1]).toHaveLength(100);
    expect(chunks[2]).toHaveLength(50);
  });
});
