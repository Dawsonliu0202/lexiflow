import type { Deps } from './types';
import type { TranslateRequest, AiWordEntry } from '../shared/types';
import { buildMessages } from '../services/ai/prompt';
import { finalizeEntry } from '../services/ai/parse';
import { simpleHash } from '../shared/utils';
import { LexiFlowError } from '../shared/errors';
import { log } from '../shared/log';

// In-memory LRU cache (50 items) to prevent repeated duplicate billings
const queryCache = new Map<string, AiWordEntry>();
const CACHE_LIMIT = 50;

function setCache(key: string, value: AiWordEntry): void {
  if (queryCache.size >= CACHE_LIMIT) {
    const firstKey = queryCache.keys().next().value;
    if (firstKey !== undefined) {
      queryCache.delete(firstKey);
    }
  }
  queryCache.set(key, value);
}

export function createTranslateUseCase(deps: Deps) {
  return async function translate(
    req: TranslateRequest,
    options: {
      signal?: AbortSignal;
      onChunk?: (text: string) => void;
    } = {}
  ): Promise<AiWordEntry> {
    const cacheKey = simpleHash(`${req.word}:${req.sentence}`);
    const cached = queryCache.get(cacheKey);
    if (cached) {
      log.debug('usecase:translate', `Cache hit for '${req.word}'`);
      options.onChunk?.(JSON.stringify(cached));
      return cached;
    }

    const aiConfig = await deps.storage.get('aiConfig');
    if (!aiConfig?.apiKey) {
      throw new LexiFlowError('AI_NOT_CONFIGURED', '尚未配置 AI 接口，请先在设置页填写 API Key。');
    }

    const messages = buildMessages(req, aiConfig);

    const fullText = await deps.ai.streamChat(aiConfig, messages, {
      signal: options.signal,
      onDelta: (_delta, accumulated) => {
        options.onChunk?.(accumulated);
      },
    });

    const entry = finalizeEntry(fullText, req.word);
    if (req.mode) {
      entry.mode = req.mode;
    }
    setCache(cacheKey, entry);
    return entry;
  };
}
