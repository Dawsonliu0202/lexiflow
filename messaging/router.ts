import type { Deps } from '../usecases/types';
import type {
  RpcMap,
  RpcType,
  RpcRequest,
  RpcResponse,
  StreamC2S,
  StreamS2C,
} from '../shared/messages';
import { isRpcType, PORT_TRANSLATE } from '../shared/messages';
import { toAppError, LexiFlowError } from '../shared/errors';
import { log } from '../shared/log';
import { createSaveWordUseCase } from '../usecases/saveWord';
import { createGetWordStateUseCase } from '../usecases/getWordState';
import { createSyncNowUseCase } from '../usecases/syncNow';
import { createSetSiteDisabledUseCase } from '../usecases/setSiteDisabled';
import { createTestAiUseCase } from '../usecases/testAi';
import { createConnectNotionUseCase } from '../usecases/connectNotion';
import { createDisconnectNotionUseCase } from '../usecases/disconnectNotion';
import { createTranslateUseCase } from '../usecases/translate';

// Permitted RPC types from Content Scripts (isolated world)
const CS_ALLOWED_RPCS = new Set<RpcType>([
  'SAVE_WORD',
  'GET_WORD_STATE',
  'GET_SITE_DISABLED',
]);

export function setupMessageRouter(deps: Deps): void {
  const saveWord = createSaveWordUseCase(deps);
  const getWordState = createGetWordStateUseCase(deps);
  const syncNow = createSyncNowUseCase(deps);
  const setSiteDisabled = createSetSiteDisabledUseCase(deps);
  const testAi = createTestAiUseCase(deps);
  const connectNotion = createConnectNotionUseCase(deps);
  const disconnectNotion = createDisconnectNotionUseCase(deps);
  const translate = createTranslateUseCase(deps);

  type HandlerMap = {
    [K in RpcType]: (
      payload: RpcMap[K]['req'],
      sender: chrome.runtime.MessageSender
    ) => Promise<RpcMap[K]['res']>;
  };

  const handlers: HandlerMap = {
    SAVE_WORD: async (payload) => await saveWord(payload.entry, payload.context),
    GET_WORD_STATE: async (payload) => await getWordState(payload.lemma),
    SYNC_RETRY: async (payload) => await syncNow(payload.id),
    SYNC_NOW: async () => await syncNow(),
    GET_SITE_DISABLED: async (payload) => {
      const list = (await deps.storage.get('disabledHosts')) || [];
      const disabled = list.map((h) => h.toLowerCase()).includes(payload.host.toLowerCase());
      return { disabled };
    },
    SET_SITE_DISABLED: async (payload) => await setSiteDisabled(payload.host, payload.disabled),
    TEST_AI: async (payload) => await testAi(payload),
    CONNECT_NOTION: async () => await connectNotion(),
    DISCONNECT_NOTION: async () => await disconnectNotion(),
    GET_STATUS: async () => {
      const stats = await deps.db.stats();
      return await deps.storage.getPublicStatus(stats.pending, stats.failed, stats.synced);
    },
  };

  // 1. One-shot RPC router
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(
      (
        msg: RpcRequest<RpcType>,
        sender: chrome.runtime.MessageSender,
        sendResponse: (res: RpcResponse) => void
      ) => {
        // Security check: only messages from our own extension
        if (sender.id !== chrome.runtime.id) {
          return false;
        }

        if (!msg || !isRpcType(msg.type)) {
          return false;
        }

        // Check if sender is Content Script
        const isContentScript = !!sender.tab && (!sender.url || !sender.url.startsWith('chrome-extension://'));

        if (isContentScript && !CS_ALLOWED_RPCS.has(msg.type)) {
          log.warn('router', `Permission denied for CS calling ${msg.type}`);
          sendResponse({
            ok: false,
            error: toAppError(
              new LexiFlowError('PERMISSION_DENIED', `Content script 无权执行 ${msg.type}`)
            ),
          });
          return false;
        }

        const handler = handlers[msg.type];
        if (!handler) {
          return false;
        }

        // Execute async handler
        handler(msg.payload as never, sender)
          .then((data) => {
            sendResponse({ ok: true, data });
          })
          .catch((err) => {
            sendResponse({ ok: false, error: toAppError(err) });
          });

        return true; // Keep channel open for asynchronous response
      }
    );
  }

  // 2. Long-lived streaming Port router (port name: 'translate')
  if (typeof chrome !== 'undefined' && chrome.runtime?.onConnect) {
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== PORT_TRANSLATE) return;

      let abortController: AbortController | null = null;
      let lastChunkTime = 0;
      const CHUNK_THROTTLE_MS = 50;

      port.onMessage.addListener((msg: StreamC2S) => {
        if (msg.type === 'ABORT') {
          if (abortController) {
            abortController.abort();
            abortController = null;
          }
          return;
        }

        if (msg.type === 'TRANSLATE') {
          if (abortController) {
            abortController.abort();
          }
          abortController = new AbortController();
          const { requestId, payload } = msg;

          translate(payload, {
            signal: abortController.signal,
            onChunk: (accumulatedText) => {
              const now = Date.now();
              if (now - lastChunkTime >= CHUNK_THROTTLE_MS) {
                lastChunkTime = now;
                const chunkMsg: StreamS2C = {
                  type: 'CHUNK',
                  requestId,
                  text: accumulatedText,
                };
                port.postMessage(chunkMsg);
              }
            },
          })
            .then((entry) => {
              const doneMsg: StreamS2C = {
                type: 'DONE',
                requestId,
                entry,
              };
              port.postMessage(doneMsg);
            })
            .catch((err) => {
              const appErr = toAppError(err);
              const errMsg: StreamS2C = {
                type: 'ERROR',
                requestId,
                error: appErr,
              };
              port.postMessage(errMsg);
            });
        }
      });

      port.onDisconnect.addListener(() => {
        if (abortController) {
          abortController.abort();
          abortController = null;
        }
      });
    });
  }
}
