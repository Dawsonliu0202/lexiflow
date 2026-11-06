import type { AppError } from '../../shared/errors';
import type { NotionStatus } from '../../shared/types';

export type RetryDecision =
  | { kind: 'retry'; delayMs: number }
  | { kind: 'fail' }
  | { kind: 'pause'; until?: number; status?: NotionStatus };

export const MAX_RETRY_COUNT = 8;
export const BASE_DELAY_MS = 30_000; // 30s
export const MAX_DELAY_MS = 1_800_000; // 30m

export function computeBackoff(retryCount: number, randomFn = Math.random): number {
  const exponential = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS);
  // Jitter factor between 0.8 and 1.2
  const jitter = 0.8 + randomFn() * 0.4;
  return Math.round(exponential * jitter);
}

export function classify(
  err: AppError,
  retryCount: number,
  randomFn = Math.random
): RetryDecision {
  const code = err.code;

  // 1. Rate Limit (429)
  if (code === 'NOTION_RATE_LIMIT') {
    const detail = err.detail as { retryAfterSec?: number } | undefined;
    const sec = detail?.retryAfterSec && detail.retryAfterSec > 0 ? detail.retryAfterSec : 15;
    return {
      kind: 'pause',
      until: Date.now() + sec * 1000,
    };
  }

  // 2. Token revoked or expired (401)
  if (code === 'NOTION_AUTH') {
    return {
      kind: 'pause',
      status: 'reauth_required',
    };
  }

  // 3. Database deleted or unshared (404)
  if (code === 'NOTION_NOT_FOUND') {
    return {
      kind: 'pause',
      status: 'rebind_required',
    };
  }

  // 4. Schema validation error (400)
  if (code === 'NOTION_VALIDATION') {
    // Retry once in case of temporary validation issue, otherwise fail
    if (retryCount === 0) {
      return { kind: 'retry', delayMs: 2000 };
    }
    return { kind: 'fail' };
  }

  // 5. Exceeded max retries
  if (retryCount >= MAX_RETRY_COUNT) {
    return { kind: 'fail' };
  }

  // 6. Temporary errors (Network, 5xx server, 409 conflict)
  if (code === 'NOTION_NETWORK' || code === 'NOTION_SERVER' || code === 'NOTION_CONFLICT') {
    const delayMs = computeBackoff(retryCount, randomFn);
    return { kind: 'retry', delayMs };
  }

  // Other non-recoverable errors
  return { kind: 'fail' };
}
