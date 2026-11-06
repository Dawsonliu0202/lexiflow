import { LexiFlowError } from '../../shared/errors';
import { log } from '../../shared/log';

export const NOTION_BASE_URL = 'https://api.notion.com/v1';
export const NOTION_VERSION = '2022-06-28';

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 350;

async function throttle(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    const wait = MIN_REQUEST_INTERVAL_MS - elapsed;
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastRequestTime = Date.now();
}

export async function notionFetch<T = unknown>(
  path: string,
  accessToken: string,
  init: RequestInit = {}
): Promise<T> {
  await throttle();

  const url = path.startsWith('http') ? path : `${NOTION_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${accessToken.trim()}`);
  headers.set('Notion-Version', NOTION_VERSION);
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
    });
  } catch (err) {
    log.error('notion', `Network request failed: ${url}`, err);
    throw new LexiFlowError(
      'NOTION_NETWORK',
      `无法连接到 Notion: ${(err as Error).message || '网络连接异常'}`,
      true
    );
  }

  if (res.ok) {
    // 204 No Content
    if (res.status === 204) return {} as T;
    return (await res.json()) as T;
  }

  let errorBody: { code?: string; message?: string } = {};
  try {
    errorBody = await res.json();
  } catch {
    // Ignore JSON parse error on non-ok response
  }

  const status = res.status;
  const msg = errorBody.message || `Notion HTTP ${status}`;

  if (status === 401) {
    throw new LexiFlowError('NOTION_AUTH', `Notion 凭证失效: ${msg}`);
  }
  if (status === 404) {
    throw new LexiFlowError('NOTION_NOT_FOUND', `Notion 对象不存在或未授权: ${msg}`);
  }
  if (status === 429) {
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfterSec = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 5;
    throw new LexiFlowError('NOTION_RATE_LIMIT', `Notion 请求频率限制: ${msg}`, true, {
      retryAfterSec,
    });
  }
  if (status === 400) {
    throw new LexiFlowError('NOTION_VALIDATION', `Notion 数据验证失败: ${msg}`, false, errorBody);
  }
  if (status === 409) {
    throw new LexiFlowError('NOTION_CONFLICT', `Notion 数据版本冲突: ${msg}`, true);
  }
  if (status >= 500) {
    throw new LexiFlowError('NOTION_SERVER', `Notion 服务端暂时不可用 (${status}): ${msg}`, true);
  }

  throw new LexiFlowError('UNKNOWN', `Notion 请求失败 (${status}): ${msg}`);
}
