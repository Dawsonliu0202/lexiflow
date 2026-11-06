import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { LexiFlowDatabase } from '../db/index';
import { DexieWordRepo } from '../db/wordRepo';
import type { AiWordEntry, WordContextInput } from '../shared/types';

describe('Word Repository (db/wordRepo)', () => {
  let testDb: LexiFlowDatabase;
  let repo: DexieWordRepo;

  beforeEach(() => {
    testDb = new LexiFlowDatabase(`test-db-${Date.now()}-${Math.random()}`);
    repo = new DexieWordRepo(testDb);
  });

  const entry: AiWordEntry = {
    word: 'burden',
    lemma: 'burden',
    phonetic: '/ˈbɜːrdn/',
    contextMeaning: '重担',
    coreMeanings: ['n. 重担'],
    analysis: '经济压力。',
  };

  const context1: WordContextInput = {
    sentence: 'Prices place a heavy burden on families.',
    pageTitle: 'News 1',
    pageUrl: 'https://news.com/1',
  };

  const context2: WordContextInput = {
    sentence: 'He could not carry this burden alone.',
    pageTitle: 'Story 2',
    pageUrl: 'https://story.com/2',
  };

  it('creates a new record on first save', async () => {
    const res = await repo.saveOrIncrement(entry, context1);
    expect(res.isNew).toBe(true);
    expect(res.count).toBe(1);

    const word = await repo.findByLemma('burden');
    expect(word).toBeDefined();
    expect(word?.count).toBe(1);
    expect(word?.syncStatus).toBe('pending');
    expect(word?.rev).toBe(1);
    expect(word?.unsyncedDelta).toBe(1);
    expect(word?.contexts).toHaveLength(1);
  });

  it('does not increment count when saving the exact same sentence again', async () => {
    await repo.saveOrIncrement(entry, context1);
    const res2 = await repo.saveOrIncrement(entry, context1);

    expect(res2.isNew).toBe(false);
    expect(res2.count).toBe(1);

    const word = await repo.findByLemma('burden');
    expect(word?.count).toBe(1);
    expect(word?.contexts).toHaveLength(1);
  });

  it('increments count and appends context when saving a new sentence', async () => {
    await repo.saveOrIncrement(entry, context1);
    const res2 = await repo.saveOrIncrement(entry, context2);

    expect(res2.isNew).toBe(false);
    expect(res2.count).toBe(2);

    const word = await repo.findByLemma('burden');
    expect(word?.count).toBe(2);
    expect(word?.rev).toBe(2);
    expect(word?.unsyncedDelta).toBe(2);
    expect(word?.contexts).toHaveLength(2);
    expect(word?.contexts[0].sentence).toBe(context2.sentence);
  });

  it('handles concurrent updates and rev matching during markSynced', async () => {
    await repo.saveOrIncrement(entry, context1);
    const word = (await repo.findByLemma('burden'))!;
    const originalRev = word.rev; // 1
    const ctxId1 = word.contexts[0].id;

    // Simulate concurrent save during sync: user adds context2
    await repo.saveOrIncrement(entry, context2);
    const updatedWord = (await repo.findByLemma('burden'))!;
    expect(updatedWord.rev).toBe(2);
    expect(updatedWord.unsyncedDelta).toBe(2);

    // Sync completes for the 1st request (syncedDelta = 1, syncedRev = originalRev)
    await repo.markSynced(word.id!, originalRev, 1, [ctxId1], 'notion-page-123');

    // Because rev != originalRev, remaining delta should be 1, and status remains 'pending'
    const wordAfterSync = (await repo.findByLemma('burden'))!;
    expect(wordAfterSync.syncStatus).toBe('pending');
    expect(wordAfterSync.unsyncedDelta).toBe(1);
    expect(wordAfterSync.notionPageId).toBe('notion-page-123');
  });

  it('claims pending words atomically and marks them as syncing', async () => {
    await repo.saveOrIncrement(entry, context1);
    const claimed = await repo.claimPending(1);

    expect(claimed).toHaveLength(1);
    expect(claimed[0].syncStatus).toBe('syncing');

    // Attempting to claim again yields 0 words
    const claimedAgain = await repo.claimPending(1);
    expect(claimedAgain).toHaveLength(0);
  });

  it('resets stuck syncing words older than threshold', async () => {
    await repo.saveOrIncrement(entry, context1);
    await repo.claimPending(1);

    // With 0ms threshold, the claimed word is immediately considered stuck
    const resetCount = await repo.resetStuckSyncing(0);
    expect(resetCount).toBe(1);

    const word = (await repo.findByLemma('burden'))!;
    expect(word.syncStatus).toBe('pending');
  });
});
