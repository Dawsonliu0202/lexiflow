import { notionFetch } from './api';
import type { Word, WordContext } from '../../shared/types';
import { toDatabaseProperties, toContextBlocks, chunkBlocks } from './mapper';

export interface NotionPageMatch {
  pageId: string;
  count: number;
}

export async function findPageByLemma(
  accessToken: string,
  dbId: string,
  lemma: string
): Promise<NotionPageMatch | null> {
  const data = await notionFetch<{
    results: Array<{
      id: string;
      properties?: Record<string, { number?: number }>;
    }>;
  }>(`/databases/${dbId}/query`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      filter: {
        property: 'Lemma',
        title: {
          equals: lemma.trim().toLowerCase(),
        },
      },
      page_size: 1,
    }),
  });

  if (!data.results || data.results.length === 0) {
    return null;
  }

  const match = data.results[0];
  const countProp = match.properties?.['Count'];
  const count = typeof countProp?.number === 'number' ? countProp.number : 1;

  return {
    pageId: match.id,
    count,
  };
}

export async function createPage(
  accessToken: string,
  dbId: string,
  word: Word
): Promise<{ pageId: string }> {
  const properties = toDatabaseProperties(word, 'create');
  const initialBlocks = toContextBlocks(word.contexts);
  // Cap initial blocks at 100 for page creation
  const firstBatch = initialBlocks.slice(0, 100);

  const res = await notionFetch<{ id: string }>(`/pages`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      parent: { database_id: dbId },
      properties,
      children: firstBatch,
    }),
  });

  // If there are more than 100 blocks, append the rest
  if (initialBlocks.length > 100) {
    const remaining = initialBlocks.slice(100);
    await appendBlocks(accessToken, res.id, remaining);
  }

  return { pageId: res.id };
}

export async function updatePage(
  accessToken: string,
  pageId: string,
  word: Word,
  targetCount: number
): Promise<void> {
  const properties = toDatabaseProperties(word, 'update', targetCount);
  await notionFetch(`/pages/${pageId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
}

export async function appendBlocks(
  accessToken: string,
  pageId: string,
  blocks: Array<Record<string, unknown>>
): Promise<void> {
  if (blocks.length === 0) return;

  const batches = chunkBlocks(blocks, 100);
  for (const batch of batches) {
    await notionFetch(`/blocks/${pageId}/children`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({ children: batch }),
    });
  }
}

export async function listRecentBulletSentences(
  accessToken: string,
  pageId: string,
  limit = 25
): Promise<string[]> {
  try {
    const res = await notionFetch<{
      results: Array<{
        type: string;
        bulleted_list_item?: {
          rich_text?: Array<{ plain_text?: string }>;
        };
      }>;
    }>(`/blocks/${pageId}/children?page_size=${limit}`, accessToken, {
      method: 'GET',
    });

    const sentences: string[] = [];
    for (const block of res.results || []) {
      if (block.type === 'bulleted_list_item' && block.bulleted_list_item?.rich_text) {
        const fullText = block.bulleted_list_item.rich_text
          .map((rt) => rt.plain_text || '')
          .join('');
        sentences.push(fullText);
      }
    }
    return sentences;
  } catch {
    return [];
  }
}
