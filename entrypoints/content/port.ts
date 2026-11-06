import type {
  TranslateRequest,
  AiWordEntry,
  StreamC2S,
  StreamS2C,
} from '../../shared/messages';
import { PORT_TRANSLATE } from '../../shared/messages';
import type { AppError } from '../../shared/errors';
import { createId } from '../../shared/utils';

export interface ContentStreamCallbacks {
  onChunk: (text: string) => void;
  onDone: (entry: AiWordEntry) => void;
  onError: (error: AppError) => void;
}

export class ContentTranslateClient {
  private port: chrome.runtime.Port | null = null;
  private currentRequestId: string | null = null;

  start(payload: TranslateRequest, callbacks: ContentStreamCallbacks): () => void {
    this.abort();

    const requestId = createId();
    this.currentRequestId = requestId;

    try {
      this.port = chrome.runtime.connect({ name: PORT_TRANSLATE });
    } catch {
      callbacks.onError({
        code: 'UNKNOWN',
        message: '无法连接到扩展后台服务',
        retryable: false,
      });
      return () => {};
    }

    let finished = false;

    this.port.onMessage.addListener((msg: StreamS2C) => {
      if (msg.requestId !== requestId) return;

      if (msg.type === 'CHUNK') {
        callbacks.onChunk(msg.text);
      } else if (msg.type === 'DONE') {
        finished = true;
        callbacks.onDone(msg.entry);
        this.cleanup();
      } else if (msg.type === 'ERROR') {
        finished = true;
        callbacks.onError(msg.error);
        this.cleanup();
      }
    });

    this.port.onDisconnect.addListener(() => {
      if (!finished) {
        callbacks.onError({
          code: 'AI_NETWORK',
          message: '后台服务连接断开',
          retryable: true,
        });
      }
      this.cleanup();
    });

    const msg: StreamC2S = {
      type: 'TRANSLATE',
      requestId,
      payload,
    };
    this.port.postMessage(msg);

    return () => this.abort();
  }

  abort(): void {
    if (this.port && this.currentRequestId) {
      try {
        const abortMsg: StreamC2S = {
          type: 'ABORT',
          requestId: this.currentRequestId,
        };
        this.port.postMessage(abortMsg);
      } catch {
        // Ignore
      }
    }
    this.cleanup();
  }

  private cleanup(): void {
    if (this.port) {
      try {
        this.port.disconnect();
      } catch {
        // Ignore
      }
      this.port = null;
    }
    this.currentRequestId = null;
  }
}
