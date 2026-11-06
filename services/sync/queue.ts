import type { WordRepo } from '../../db/wordRepo';
import { wordRepo as defaultWordRepo } from '../../db/wordRepo';
import type { NotionGateway } from '../notion/gateway';
import { notionGateway as defaultNotionGateway } from '../notion/gateway';
import { storage } from '../../shared/storage';
import { classify } from './retry';
import { toAppError } from '../../shared/errors';
import { log } from '../../shared/log';

export interface SyncEngineDeps {
  repo?: WordRepo;
  gateway?: NotionGateway;
}

export class SyncEngine {
  private isProcessing = false;

  constructor(private deps: SyncEngineDeps = {}) {}

  private get repo(): WordRepo {
    return this.deps.repo || defaultWordRepo;
  }

  private get gateway(): NotionGateway {
    return this.deps.gateway || defaultNotionGateway;
  }

  async kick(): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      // Use Web Locks API to ensure single worker execution
      await navigator.locks.request(
        'lexiflow-sync',
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            log.debug('sync', 'Sync lock already acquired by another worker');
            return;
          }
          await this.runLoop();
        }
      );
    } else {
      // In-memory fallback lock for environments without Web Locks
      if (this.isProcessing) return;
      this.isProcessing = true;
      try {
        await this.runLoop();
      } finally {
        this.isProcessing = false;
      }
    }
  }

  private async canRun(): Promise<boolean> {
    const notionStatus = await storage.get('notionStatus');
    if (notionStatus !== 'connected') {
      log.debug('sync', `Sync gated: notionStatus is ${notionStatus}`);
      return false;
    }

    const pausedUntil = await storage.get('pausedUntil');
    if (pausedUntil && pausedUntil > Date.now()) {
      log.debug('sync', `Sync gated: paused until ${new Date(pausedUntil).toISOString()}`);
      return false;
    }

    return true;
  }

  private async runLoop(): Promise<void> {
    if (!(await this.canRun())) return;

    // Reset stuck syncing words (e.g. if SW was killed > 5 mins ago)
    await this.repo.resetStuckSyncing(5 * 60 * 1000);

    while (true) {
      if (!(await this.canRun())) break;

      const words = await this.repo.claimPending(1, Date.now());
      if (words.length === 0) {
        log.debug('sync', 'Queue empty or all pending words in backoff');
        break;
      }

      const word = words[0];
      try {
        log.info('sync', `Syncing word '${word.lemma}' (rev: ${word.rev}, delta: ${word.unsyncedDelta})`);
        const result = await this.gateway.upsertWord(word);

        await this.repo.markSynced(
          word.id!,
          word.rev,
          result.syncedDelta,
          result.syncedContextIds,
          result.pageId
        );
        log.info('sync', `Word '${word.lemma}' synced successfully`);
      } catch (rawError) {
        const appErr = toAppError(rawError);
        log.warn('sync', `Sync failed for '${word.lemma}': [${appErr.code}] ${appErr.message}`);

        const decision = classify(appErr, word.retryCount);

        if (decision.kind === 'retry') {
          const nextRetryAt = Date.now() + decision.delayMs;
          await this.repo.markRetry(word.id!, appErr.message, nextRetryAt);
        } else if (decision.kind === 'fail') {
          await this.repo.markFailed(word.id!, appErr.message);
        } else if (decision.kind === 'pause') {
          // Rollback the current word from 'syncing' back to 'pending'
          await this.repo.markRetry(word.id!, appErr.message, 0, word.retryCount);

          if (decision.status) {
            await storage.set('notionStatus', decision.status);
          }
          if (decision.until) {
            await storage.set('pausedUntil', decision.until);
          }
          break; // Stop sync loop
        }
      }
    }
  }
}

export const syncEngine = new SyncEngine();
