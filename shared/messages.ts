import type {
  AiWordEntry,
  WordContextInput,
  AiConfig,
  NotionConnectResult,
  AppStatus,
  TranslateRequest,
} from './types';
import type { AppError } from './errors';

export type { TranslateRequest, AiWordEntry };

export interface RpcMap {
  SAVE_WORD: {
    req: { entry: AiWordEntry; context: WordContextInput };
    res: { count: number; isNew: boolean };
  };
  GET_WORD_STATE: {
    req: { lemma: string };
    res: { exists: boolean; count: number };
  };
  SYNC_RETRY: {
    req: { id?: number };
    res: { queued: number };
  };
  GET_SITE_DISABLED: {
    req: { host: string };
    res: { disabled: boolean };
  };
  SET_SITE_DISABLED: {
    req: { host: string; disabled: boolean };
    res: void;
  };
  TEST_AI: {
    req: AiConfig;
    res: { ok: boolean; ms: number; error?: string };
  };
  CONNECT_NOTION: {
    req: void;
    res: NotionConnectResult;
  };
  DISCONNECT_NOTION: {
    req: void;
    res: void;
  };
  GET_STATUS: {
    req: void;
    res: AppStatus;
  };
  SYNC_NOW: {
    req: void;
    res: { queued: number };
  };
}

export type RpcType = keyof RpcMap;

export interface RpcRequest<K extends RpcType = RpcType> {
  type: K;
  payload: RpcMap[K]['req'];
}

export type RpcResponse<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };

export const PORT_TRANSLATE = 'translate';

export type StreamC2S =
  | { type: 'TRANSLATE'; requestId: string; payload: TranslateRequest }
  | { type: 'ABORT'; requestId: string };

export type StreamS2C =
  | { type: 'CHUNK'; requestId: string; text: string }
  | { type: 'DONE'; requestId: string; entry: AiWordEntry }
  | { type: 'ERROR'; requestId: string; error: AppError };

export function isRpcType(type: unknown): type is RpcType {
  return (
    typeof type === 'string' &&
    [
      'SAVE_WORD',
      'GET_WORD_STATE',
      'SYNC_RETRY',
      'GET_SITE_DISABLED',
      'SET_SITE_DISABLED',
      'TEST_AI',
      'CONNECT_NOTION',
      'DISCONNECT_NOTION',
      'GET_STATUS',
      'SYNC_NOW',
    ].includes(type)
  );
}
