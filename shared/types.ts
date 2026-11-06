export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface WordContext {
  id: string; // nanoid
  sentence: string; // 完整原句
  contextMeaning: string; // 该次语境下的释义
  pageTitle: string;
  pageUrl: string;
  capturedAt: number; // ms timestamp
}

export interface Word {
  id?: number;
  lemma: string; // 唯一键, 小写词典原形
  word: string; // 最近一次遇到的原词形式
  phonetic: string;
  contextMeaning: string; // 最近一次语境释义
  coreMeanings: string[]; // 核心词义(≤3)
  analysis: string; // 简明解析
  count: number; // 遇到次数(本地累计)
  contexts: WordContext[]; // 最近 ≤20 条, 新→旧
  firstSeenAt: number;
  updatedAt: number;

  // ---- 同步元数据 ----
  syncStatus: SyncStatus;
  rev: number; // 每次本地变更 +1, 用于并发同步冲突判断
  unsyncedDelta: number; // 尚未同步到 Notion 的次数增量
  unsyncedContextIds: string[]; // 尚未同步的语境 ID
  notionPageId?: string;
  retryCount: number;
  nextRetryAt: number; // 0 表示立即可执行
  lastError?: string;
  lastSyncedAt?: number;
}

export interface AiWordEntry {
  word: string; // 原词(选中文本, 保留原大小写/形态)
  lemma: string; // 词典原形, 小写
  phonetic: string; // 音标, 如 "/ˈbɜːdn/"
  contextMeaning: string; // 当前语境下的释义
  coreMeanings: string[]; // 核心词义 ≤3
  analysis: string; // 简明解析 ≤60 字
}

export interface TranslateRequest {
  word: string;
  sentence: string;
  pageTitle: string;
  pageUrl: string;
}

export interface WordContextInput {
  sentence: string;
  pageTitle: string;
  pageUrl: string;
}

export interface AiConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  targetLang: string;
}

export interface NotionAppConfig {
  clientId: string;
  clientSecret: string;
}

export interface NotionAuth {
  accessToken: string;
  workspaceId: string;
  workspaceName: string;
  workspaceIcon?: string;
  botId: string;
  connectedAt: number;
}

export interface NotionBinding {
  databaseId: string;
  databaseUrl: string;
  parentPageId: string;
  boundAt: number;
}

export type NotionStatus =
  | 'disconnected'
  | 'connected'
  | 'reauth_required'
  | 'rebind_required'
  | 'schema_mismatch';

export interface StorageSchema {
  aiConfig: AiConfig;
  notionApp: NotionAppConfig;
  notionAuth?: NotionAuth;
  notionBinding?: NotionBinding;
  notionStatus: NotionStatus;
  disabledHosts: string[];
  pausedUntil?: number;
}

export interface AppStatus {
  aiConfigured: boolean;
  aiModel?: string;
  notionStatus: NotionStatus;
  workspaceName?: string;
  databaseUrl?: string;
  pendingCount: number;
  failedCount: number;
  syncedCount: number;
}

export interface NotionConnectResult {
  ok: boolean;
  workspaceName: string;
  databaseId: string;
  databaseUrl: string;
}
