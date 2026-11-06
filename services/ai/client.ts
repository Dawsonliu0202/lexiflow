import type { AiConfig } from '../../shared/types';
import type { ChatMessage } from './prompt';
import { LexiFlowError } from '../../shared/errors';
import { normalizeBaseUrl } from './normalize';
import { log } from '../../shared/log';

// In-memory cache for models that don't support response_format: { type: 'json_object' }
const unsupportedJsonFormatModels = new Set<string>();

export interface StreamChatOptions {
  signal?: AbortSignal;
  onDelta?: (chunk: string, accumulated: string) => void;
}

export class AiClient {
  async streamChat(
    cfg: AiConfig,
    messages: ChatMessage[],
    options: StreamChatOptions = {}
  ): Promise<string> {
    if (!cfg.apiKey) {
      throw new LexiFlowError('AI_NOT_CONFIGURED', '尚未配置 AI API Key');
    }

    const baseUrl = normalizeBaseUrl(cfg.baseUrl || 'https://api.openai.com/v1');
    const endpoint = `${baseUrl}/chat/completions`;
    const modelKey = `${baseUrl}:${cfg.model}`;
    const supportsJsonObject = !unsupportedJsonFormatModels.has(modelKey);

    const makeBody = (withJsonObject: boolean) => ({
      model: cfg.model || 'gpt-4o-mini',
      messages,
      temperature: cfg.temperature ?? 0.2,
      stream: true,
      ...(withJsonObject ? { response_format: { type: 'json_object' } } : {}),
    });

    let res = await this.fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey.trim()}`,
        },
        body: JSON.stringify(makeBody(supportsJsonObject)),
        signal: options.signal,
      },
      20000,
      options.signal
    );

    // Fallback: if json_object is not supported (400 bad request)
    if (!res.ok && res.status === 400 && supportsJsonObject) {
      const errText = await res.text();
      if (errText.includes('response_format') || errText.includes('json_object')) {
        log.warn('ai', `Model does not support json_object, falling back: ${cfg.model}`);
        unsupportedJsonFormatModels.add(modelKey);

        res = await this.fetchWithTimeout(
          endpoint,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cfg.apiKey.trim()}`,
            },
            body: JSON.stringify(makeBody(false)),
            signal: options.signal,
          },
          20000,
          options.signal
        );
      } else {
        this.handleHttpError(res.status, errText);
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      this.handleHttpError(res.status, errText);
    }

    if (!res.body) {
      throw new LexiFlowError('AI_NETWORK', 'AI 服务端未返回响应流');
    }

    return await this.consumeSseStream(res.body, options);
  }

  async testConnection(cfg: AiConfig): Promise<{ ok: boolean; ms: number; error?: string }> {
    const start = Date.now();
    try {
      const baseUrl = normalizeBaseUrl(cfg.baseUrl || 'https://api.openai.com/v1');
      const endpoint = `${baseUrl}/chat/completions`;

      const res = await this.fetchWithTimeout(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey.trim()}`,
          },
          body: JSON.stringify({
            model: cfg.model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 5,
          }),
        },
        10000
      );

      const ms = Date.now() - start;
      if (!res.ok) {
        const errText = await res.text();
        return { ok: false, ms, error: `HTTP ${res.status}: ${errText.slice(0, 100)}` };
      }
      return { ok: true, ms };
    } catch (err) {
      return {
        ok: false,
        ms: Date.now() - start,
        error: (err as Error).message || '连接失败',
      };
    }
  }

  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeoutMs = 20000,
    parentSignal?: AbortSignal
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (parentSignal) {
      parentSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        if (parentSignal?.aborted) {
          throw new LexiFlowError('AI_ABORTED', '请求已被取消');
        }
        throw new LexiFlowError('AI_TIMEOUT', `AI 请求首字节超时 (${timeoutMs / 1000}s)`);
      }
      throw new LexiFlowError(
        'AI_NETWORK',
        `网络请求失败: ${(err as Error)?.message || '无法连接到服务器'}`,
        true
      );
    } finally {
      clearTimeout(timer);
    }
  }

  private handleHttpError(status: number, bodyText: string): never {
    if (status === 401 || status === 403) {
      throw new LexiFlowError('AI_AUTH', `AI API Key 鉴权失败 (${status}): ${bodyText.slice(0, 100)}`);
    }
    if (status === 404) {
      throw new LexiFlowError('AI_NOT_FOUND', `AI 接口或模型未找到 (404)`);
    }
    if (status === 429) {
      throw new LexiFlowError('AI_RATE_LIMIT', `AI 请求过于频繁 (429)`);
    }
    if (status >= 500) {
      throw new LexiFlowError(
        'AI_NETWORK',
        `AI 服务端错误 (${status}): ${bodyText.slice(0, 100)}`,
        true
      );
    }
    throw new LexiFlowError('UNKNOWN', `AI 请求错误 (${status}): ${bodyText.slice(0, 100)}`);
  }

  private async consumeSseStream(
    body: ReadableStream<Uint8Array>,
    options: StreamChatOptions
  ): Promise<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let accumulated = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last partial line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(':')) continue; // comments or empty

          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === '[DONE]') {
              return accumulated;
            }

            try {
              const parsed = JSON.parse(dataStr);
              const contentDelta = parsed.choices?.[0]?.delta?.content;
              if (contentDelta) {
                accumulated += contentDelta;
                options.onDelta?.(contentDelta, accumulated);
              }
            } catch {
              // Ignore partial JSON line
            }
          }
        }
      }

      return accumulated;
    } finally {
      reader.releaseLock();
    }
  }
}

export const aiClient = new AiClient();
