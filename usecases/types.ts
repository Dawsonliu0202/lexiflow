import type { WordRepo } from '../db/wordRepo';
import type { storage } from '../shared/storage';
import type { AiClient } from '../services/ai/client';
import type { NotionGateway } from '../services/notion/gateway';
import type { SyncEngine } from '../services/sync/queue';

export interface Deps {
  db: WordRepo;
  storage: typeof storage;
  ai: AiClient;
  notion: NotionGateway;
  sync: SyncEngine;
}
