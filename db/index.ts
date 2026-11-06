import Dexie, { type EntityTable } from 'dexie';
import type { Word } from '../shared/types';

export class LexiFlowDatabase extends Dexie {
  words!: EntityTable<Word, 'id'>;

  constructor(databaseName = 'lexiflow') {
    super(databaseName);
    this.version(1).stores({
      words: '++id, &lemma, syncStatus, updatedAt, nextRetryAt, notionPageId',
    });
  }
}

export const db = new LexiFlowDatabase();
