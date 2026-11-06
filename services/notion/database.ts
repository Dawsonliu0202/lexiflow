import { notionFetch } from './api';
import type { NotionBinding } from '../../shared/types';
import { LexiFlowError } from '../../shared/errors';
import { log } from '../../shared/log';

export const DATABASE_NAME = 'LexiFlow Vocabulary';

const REQUIRED_PROPERTIES_SCHEMA: Record<string, Record<string, unknown>> = {
  Word: { rich_text: {} },
  Phonetic: { rich_text: {} },
  Meaning: { rich_text: {} },
  'Core Meanings': { rich_text: {} },
  Analysis: { rich_text: {} },
  Count: { number: { format: 'number' } },
  'Latest Context': { rich_text: {} },
  Source: { url: {} },
  'Source Title': { rich_text: {} },
  'First Seen': { date: {} },
  'Last Seen': { date: {} },
  Status: {
    select: {
      options: [
        { name: 'New', color: 'gray' },
        { name: 'Learning', color: 'yellow' },
        { name: 'Mastered', color: 'green' },
      ],
    },
  },
};

export async function findDatabase(
  accessToken: string
): Promise<{ id: string; url: string; properties: Record<string, { type: string }> } | null> {
  const data = await notionFetch<{
    results: Array<{
      id: string;
      url: string;
      title?: Array<{ plain_text?: string }>;
      archived?: boolean;
      properties?: Record<string, { type: string }>;
    }>;
  }>('/search', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      query: DATABASE_NAME,
      filter: { property: 'object', value: 'database' },
    }),
  });

  for (const item of data.results || []) {
    if (item.archived) continue;
    const titleText = item.title?.map((t) => t.plain_text || '').join('').trim();
    if (titleText === DATABASE_NAME) {
      return {
        id: item.id,
        url: item.url,
        properties: item.properties || {},
      };
    }
  }

  return null;
}

export async function ensureSchema(
  accessToken: string,
  dbId: string,
  currentProperties: Record<string, { type: string }>
): Promise<void> {
  const missingProperties: Record<string, Record<string, unknown>> = {};

  for (const [propName, propDef] of Object.entries(REQUIRED_PROPERTIES_SCHEMA)) {
    if (!currentProperties[propName]) {
      missingProperties[propName] = propDef;
    }
  }

  if (Object.keys(missingProperties).length > 0) {
    log.info('notion', `Patching missing schema properties into DB ${dbId}:`, Object.keys(missingProperties));
    await notionFetch(`/databases/${dbId}`, accessToken, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: missingProperties,
      }),
    });
  }
}

export async function pickParentPage(accessToken: string): Promise<string> {
  const data = await notionFetch<{
    results: Array<{
      id: string;
      parent?: { type: string };
      archived?: boolean;
    }>;
  }>('/search', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      filter: { property: 'object', value: 'page' },
      sort: { direction: 'descending', timestamp: 'last_edited_time' },
      page_size: 10,
    }),
  });

  const validPages = (data.results || []).filter(
    (page) => !page.archived && page.parent?.type !== 'database_id'
  );

  if (validPages.length === 0) {
    throw new LexiFlowError(
      'OAUTH_NO_PARENT_PAGE',
      '授权时未勾选任何页面，请重新授权并在 Notion 中至少勾选一个页面。'
    );
  }

  return validPages[0].id;
}

export async function createDatabase(
  accessToken: string,
  parentPageId: string
): Promise<{ id: string; url: string }> {
  const properties = {
    Lemma: { title: {} },
    ...REQUIRED_PROPERTIES_SCHEMA,
  };

  const res = await notionFetch<{ id: string; url: string }>('/databases', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      parent: { type: 'page_id', page_id: parentPageId },
      title: [{ type: 'text', text: { content: DATABASE_NAME } }],
      is_inline: false,
      properties,
    }),
  });

  return { id: res.id, url: res.url };
}

export async function ensureBinding(accessToken: string): Promise<NotionBinding> {
  // 1. Search for existing database
  const existing = await findDatabase(accessToken);
  if (existing) {
    await ensureSchema(accessToken, existing.id, existing.properties);
    return {
      databaseId: existing.id,
      databaseUrl: existing.url,
      parentPageId: '',
      boundAt: Date.now(),
    };
  }

  // 2. Pick parent page and create new database
  const parentPageId = await pickParentPage(accessToken);
  const created = await createDatabase(accessToken, parentPageId);

  return {
    databaseId: created.id,
    databaseUrl: created.url,
    parentPageId,
    boundAt: Date.now(),
  };
}
