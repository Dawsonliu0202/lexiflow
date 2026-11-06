import type { LexiFlowDatabase } from './index';
import { db as defaultDb } from './index';
import type { Word, WordContext, AiWordEntry, WordContextInput } from '../shared/types';
import { createId } from '../shared/utils';

export interface WordRepo {
  saveOrIncrement(
    entry: AiWordEntry,
    ctx: WordContextInput
  ): Promise<{ count: number; isNew: boolean }>;
  claimPending(limit: number, now?: number): Promise<Word[]>;
  markSynced(
    id: number,
    rev: number,
    syncedDelta: number,
    syncedContextIds: string[],
    notionPageId?: string
  ): Promise<void>;
  markRetry(id: number, error: string, nextRetryAt: number, retryCount?: number): Promise<void>;
  markFailed(id: number, error: string): Promise<void>;
  resetStuckSyncing(olderThanMs?: number): Promise<number>;
  resetFailed(id?: number): Promise<number>;
  recent(limit?: number): Promise<Word[]>;
  findByLemma(lemma: string): Promise<Word | undefined>;
  stats(): Promise<{ pending: number; failed: number; synced: number; total: number }>;
  exportAll(): Promise<Word[]>;
}

export class DexieWordRepo implements WordRepo {
  constructor(private database: LexiFlowDatabase = defaultDb) {}

  async saveOrIncrement(
    entry: AiWordEntry,
    ctx: WordContextInput
  ): Promise<{ count: number; isNew: boolean }> {
    const lemma = entry.lemma.trim().toLowerCase();
    const now = Date.now();

    return await this.database.transaction('rw', this.database.words, async () => {
      const existing = await this.database.words.where('lemma').equals(lemma).first();

      const newContext: WordContext = {
        id: createId(),
        sentence: ctx.sentence.trim(),
        contextMeaning: entry.contextMeaning.trim(),
        pageTitle: ctx.pageTitle || '',
        pageUrl: ctx.pageUrl || '',
        capturedAt: now,
      };

      if (!existing) {
        const newWord: Word = {
          lemma,
          word: entry.word.trim(),
          phonetic: entry.phonetic || '',
          contextMeaning: entry.contextMeaning.trim(),
          coreMeanings: entry.coreMeanings || [],
          analysis: entry.analysis || '',
          count: 1,
          contexts: [newContext],
          firstSeenAt: now,
          updatedAt: now,
          syncStatus: 'pending',
          rev: 1,
          unsyncedDelta: 1,
          unsyncedContextIds: [newContext.id],
          retryCount: 0,
          nextRetryAt: 0,
        };
        await this.database.words.add(newWord);
        return { count: 1, isNew: true };
      }

      // Check if duplicate sentence already exists in contexts
      const normSentence = ctx.sentence.trim().toLowerCase();
      const hasSameSentence =
        normSentence.length > 0 &&
        existing.contexts.some((c) => c.sentence.trim().toLowerCase() === normSentence);

      if (hasSameSentence) {
        // Do not increment count or add duplicate context
        return { count: existing.count, isNew: false };
      }

      const updatedContexts = [newContext, ...existing.contexts].slice(0, 20);
      const unsyncedContextIds = [...existing.unsyncedContextIds, newContext.id];

      await this.database.words.update(existing.id!, {
        word: entry.word.trim(),
        contextMeaning: entry.contextMeaning.trim(),
        count: existing.count + 1,
        contexts: updatedContexts,
        updatedAt: now,
        syncStatus: 'pending',
        rev: existing.rev + 1,
        unsyncedDelta: existing.unsyncedDelta + 1,
        unsyncedContextIds,
        retryCount: 0,
        nextRetryAt: 0,
      });

      return { count: existing.count + 1, isNew: false };
    });
  }

  async claimPending(limit = 1, now = Date.now()): Promise<Word[]> {
    return await this.database.transaction('rw', this.database.words, async () => {
      const candidates = await this.database.words
        .where('syncStatus')
        .equals('pending')
        .filter((w) => w.nextRetryAt <= now)
        .sortBy('updatedAt');

      const selected = candidates.slice(0, limit);
      for (const word of selected) {
        await this.database.words.update(word.id!, {
          syncStatus: 'syncing',
          updatedAt: now,
        });
        word.syncStatus = 'syncing';
      }

      return selected;
    });
  }

  async markSynced(
    id: number,
    rev: number,
    syncedDelta: number,
    syncedContextIds: string[],
    notionPageId?: string
  ): Promise<void> {
    const now = Date.now();
    await this.database.transaction('rw', this.database.words, async () => {
      const word = await this.database.words.get(id);
      if (!word) return;

      const pageId = notionPageId || word.notionPageId;

      if (word.rev === rev) {
        // No local edits occurred during sync
        await this.database.words.update(id, {
          syncStatus: 'synced',
          unsyncedDelta: 0,
          unsyncedContextIds: [],
          lastSyncedAt: now,
          retryCount: 0,
          nextRetryAt: 0,
          lastError: undefined,
          notionPageId: pageId,
        });
      } else {
        // Concurrent local update occurred during sync: deduct only synced delta
        const remainingDelta = Math.max(0, word.unsyncedDelta - syncedDelta);
        const remainingContexts = word.unsyncedContextIds.filter(
          (cid) => !syncedContextIds.includes(cid)
        );
        await this.database.words.update(id, {
          syncStatus: 'pending',
          unsyncedDelta: remainingDelta,
          unsyncedContextIds: remainingContexts,
          lastSyncedAt: now,
          notionPageId: pageId,
        });
      }
    });
  }

  async markRetry(
    id: number,
    error: string,
    nextRetryAt: number,
    retryCount?: number
  ): Promise<void> {
    await this.database.transaction('rw', this.database.words, async () => {
      const word = await this.database.words.get(id);
      if (!word) return;
      const count = retryCount !== undefined ? retryCount : word.retryCount + 1;
      await this.database.words.update(id, {
        syncStatus: 'pending',
        lastError: error,
        retryCount: count,
        nextRetryAt,
      });
    });
  }

  async markFailed(id: number, error: string): Promise<void> {
    await this.database.words.update(id, {
      syncStatus: 'failed',
      lastError: error,
    });
  }

  async resetStuckSyncing(olderThanMs = 5 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - olderThanMs;
    return await this.database.transaction('rw', this.database.words, async () => {
      const stuck = await this.database.words
        .where('syncStatus')
        .equals('syncing')
        .filter((w) => w.updatedAt <= cutoff)
        .toArray();

      for (const word of stuck) {
        await this.database.words.update(word.id!, {
          syncStatus: 'pending',
          nextRetryAt: 0,
        });
      }
      return stuck.length;
    });
  }

  async resetFailed(id?: number): Promise<number> {
    return await this.database.transaction('rw', this.database.words, async () => {
      if (id !== undefined) {
        const word = await this.database.words.get(id);
        if (word && (word.syncStatus === 'failed' || word.syncStatus === 'pending')) {
          await this.database.words.update(id, {
            syncStatus: 'pending',
            retryCount: 0,
            nextRetryAt: 0,
            lastError: undefined,
          });
          return 1;
        }
        return 0;
      }

      const failed = await this.database.words
        .where('syncStatus')
        .equals('failed')
        .toArray();

      for (const word of failed) {
        await this.database.words.update(word.id!, {
          syncStatus: 'pending',
          retryCount: 0,
          nextRetryAt: 0,
          lastError: undefined,
        });
      }
      return failed.length;
    });
  }

  async recent(limit = 10): Promise<Word[]> {
    return await this.database.words
      .orderBy('updatedAt')
      .reverse()
      .limit(limit)
      .toArray();
  }

  async findByLemma(lemma: string): Promise<Word | undefined> {
    return await this.database.words
      .where('lemma')
      .equals(lemma.trim().toLowerCase())
      .first();
  }

  async stats(): Promise<{ pending: number; failed: number; synced: number; total: number }> {
    const all = await this.database.words.toArray();
    let pending = 0;
    let failed = 0;
    let synced = 0;
    for (const w of all) {
      if (w.syncStatus === 'pending' || w.syncStatus === 'syncing') pending++;
      else if (w.syncStatus === 'failed') failed++;
      else if (w.syncStatus === 'synced') synced++;
    }
    return {
      pending,
      failed,
      synced,
      total: all.length,
    };
  }

  async exportAll(): Promise<Word[]> {
    return await this.database.words.orderBy('updatedAt').reverse().toArray();
  }
}

export const wordRepo = new DexieWordRepo();
