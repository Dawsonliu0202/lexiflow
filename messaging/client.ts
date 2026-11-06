import type {
  RpcMap,
  RpcType,
  RpcRequest,
  RpcResponse,
  TranslateRequest,
  AiWordEntry,
  StreamC2S,
  StreamS2C,
} from '../shared/messages';
import { PORT_TRANSLATE } from '../shared/messages';
import type { AppError } from '../shared/errors';
import { LexiFlowError } from '../shared/errors';
import { createId } from '../shared/utils';

export async function requestRpc<K extends RpcType>(
  type: K,
  payload: RpcMap[K]['req']
): Promise<RpcMap[K]['res']> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    throw new LexiFlowError('UNKNOWN', 'chrome.runtime API 不可用');
  }

  const req: RpcRequest<K> = { type, payload };
  const res: RpcResponse<RpcMap[K]['res']> = await chrome.runtime.sendMessage(req);

  if (!res) {
    throw new LexiFlowError('UNKNOWN', '未收到 Service Worker 响应');
  }

  if (!res.ok) {
    throw new LexiFlowError(res.error.code, res.error.message, res.error.retryable, res.error.detail);
  }

  return res.data;
}

export interface StreamCallbacks {
  onChunk?: (text: string) => void;
  onDone?: (entry: AiWordEntry) => void;
  onError?: (error: AppError) => void;
}

export function openTranslateStream(
  payload: TranslateRequest,
  callbacks: StreamCallbacks
): { abort: () => void } {
  if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
    callbacks.onError?.({
      code: 'UNKNOWN',
      message: 'chrome.runtime.connect 不可用',
      retryable: false,
    });
    return { abort: () => {} };
  }

  const requestId = createId();
  let port: chrome.runtime.Port | null = chrome.runtime.connect({ name: PORT_TRANSLATE });
  let isDone = false;

  port.onMessage.addListener((msg: StreamS2C) => {
    if (msg.requestId !== requestId) return;

    if (msg.type === 'CHUNK') {
      callbacks.onChunk?.(msg.text);
    } else if (msg.type === 'DONE') {
      isDone = true;
      callbacks.onDone?.(msg.entry);
      cleanup();
    } else if (msg.type === 'ERROR') {
      isDone = true;
      callbacks.onError?.(msg.error);
      cleanup();
    }
  });

  port.onDisconnect.addListener(() => {
    if (!isDone) {
      callbacks.onError?.({
        code: 'AI_NETWORK',
        message: '与 Service Worker 连接断开',
        retryable: true,
      });
    }
    cleanup();
  });

  const translateMsg: StreamC2S = {
    type: 'TRANSLATE',
    requestId,
    payload,
  };
  port.postMessage(translateMsg);

  function cleanup() {
    if (port) {
      try {
        port.disconnect();
      } catch {
        // Ignore disconnect error
      }
      port = null;
    }
  }

  return {
    abort: () => {
      if (port) {
        try {
          const abortMsg: StreamC2S = { type: 'ABORT', requestId };
          port.postMessage(abortMsg);
        } catch {
          // Ignore
        }
        cleanup();
      }
    },
  };
}
