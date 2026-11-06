import type { StorageSchema, AppStatus, AiConfig, NotionAppConfig } from './types';

export const DEFAULT_AI_CONFIG: AiConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.2,
  targetLang: '简体中文',
};

export const DEFAULT_NOTION_APP: NotionAppConfig = {
  clientId: '',
  clientSecret: '',
};

export const DEFAULT_STORAGE: StorageSchema = {
  aiConfig: DEFAULT_AI_CONFIG,
  notionApp: DEFAULT_NOTION_APP,
  notionStatus: 'disconnected',
  disabledHosts: [],
};

// In-memory mock store for non-extension environments (e.g. unit tests)
const mockMemoryStore: Partial<StorageSchema> = { ...DEFAULT_STORAGE };

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local;
}

export const storage = {
  async get<K extends keyof StorageSchema>(k: K): Promise<StorageSchema[K]> {
    if (hasChromeStorage()) {
      const res = await chrome.storage.local.get(k);
      if (res && res[k] !== undefined) {
        return res[k] as StorageSchema[K];
      }
      return DEFAULT_STORAGE[k];
    }
    return (mockMemoryStore[k] ?? DEFAULT_STORAGE[k]) as StorageSchema[K];
  },

  async set<K extends keyof StorageSchema>(k: K, v: StorageSchema[K]): Promise<void> {
    if (hasChromeStorage()) {
      await chrome.storage.local.set({ [k]: v });
      return;
    }
    mockMemoryStore[k] = v;
  },

  async remove<K extends keyof StorageSchema>(k: K): Promise<void> {
    if (hasChromeStorage()) {
      await chrome.storage.local.remove(k);
      return;
    }
    delete mockMemoryStore[k];
  },

  watch<K extends keyof StorageSchema>(
    k: K,
    cb: (v: StorageSchema[K] | undefined) => void
  ): () => void {
    if (hasChromeStorage()) {
      const listener = (
        changes: { [key: string]: chrome.storage.StorageChange },
        area: string
      ) => {
        if (area === 'local' && changes[k]) {
          cb(changes[k].newValue as StorageSchema[K]);
        }
      };
      chrome.storage.onChanged.addListener(listener);
      return () => chrome.storage.onChanged.removeListener(listener);
    }
    return () => {};
  },

  async getPublicStatus(pendingCount = 0, failedCount = 0, syncedCount = 0): Promise<AppStatus> {
    const aiConfig = await this.get('aiConfig');
    const notionStatus = await this.get('notionStatus');
    const notionAuth = await this.get('notionAuth');
    const notionBinding = await this.get('notionBinding');

    return {
      aiConfigured: !!(aiConfig?.apiKey && aiConfig?.baseUrl && aiConfig?.model),
      aiModel: aiConfig?.model,
      notionStatus: notionStatus || 'disconnected',
      workspaceName: notionAuth?.workspaceName,
      databaseUrl: notionBinding?.databaseUrl,
      pendingCount,
      failedCount,
      syncedCount,
    };
  },
};
