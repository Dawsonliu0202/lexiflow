import type { Word, WordContext } from '../../shared/types';
import { LexiFlowError } from '../../shared/errors';
import { storage } from '../../shared/storage';
import { findPageByLemma, createPage, updatePage, appendBlocks, listRecentBulletSentences } from './pages';
import { toContextBlocks } from './mapper';

export interface UpsertResult {
  pageId: string;
  syncedDelta: number;
  syncedContextIds: string[];
}

export interface NotionGateway {
  upsertWord(word: Word): Promise<UpsertResult>;
}

export class DefaultNotionGateway implements NotionGateway {
  async upsertWord(word: Word): Promise<UpsertResult> {
    const notionAuth = await storage.get('notionAuth');
    const notionBinding = await storage.get('notionBinding');

    if (!notionAuth?.accessToken || !notionBinding?.databaseId) {
      throw new LexiFlowError('NOTION_NOT_CONNECTED', '尚未连接 Notion 工作区或未绑定数据库');
    }

    const { accessToken } = notionAuth;
    const { databaseId } = notionBinding;

    const existingMatch = await findPageByLemma(accessToken, databaseId, word.lemma);

    if (!existingMatch) {
      // 1. Create new Notion Page
      const created = await createPage(accessToken, databaseId, word);
      return {
        pageId: created.pageId,
        syncedDelta: word.unsyncedDelta,
        syncedContextIds: [...word.unsyncedContextIds],
      };
    }

    // 2. Existing page: update count and append unsynced contexts
    const existingPageId = existingMatch.pageId;
    const targetCount = existingMatch.count + word.unsyncedDelta;

    // Fetch recent bullets for idempotency check
    const recentSentences = await listRecentBulletSentences(accessToken, existingPageId, 25);
    const unsyncedContexts = word.contexts.filter((c) =>
      word.unsyncedContextIds.includes(c.id)
    );

    const contextsToAppend: WordContext[] = [];
    for (const ctx of unsyncedContexts) {
      const sentenceExcerpt = ctx.sentence.trim().slice(0, 50);
      const isAlreadyInNotion =
        sentenceExcerpt.length > 0 &&
        recentSentences.some((s) => s.includes(sentenceExcerpt));

      if (!isAlreadyInNotion) {
        contextsToAppend.push(ctx);
      }
    }

    // Update page properties
    await updatePage(accessToken, existingPageId, word, targetCount);

    // Append new bullet items if any
    if (contextsToAppend.length > 0) {
      const blocks = toContextBlocks(contextsToAppend);
      await appendBlocks(accessToken, existingPageId, blocks);
    }

    return {
      pageId: existingPageId,
      syncedDelta: word.unsyncedDelta,
      syncedContextIds: [...word.unsyncedContextIds],
    };
  }
}

export const notionGateway = new DefaultNotionGateway();
