import { describe, it, expect } from 'vitest';
import { classify, computeBackoff, MAX_RETRY_COUNT } from '../services/sync/retry';
import type { AppError } from '../shared/errors';

describe('Retry & Backoff Logic (services/sync/retry)', () => {
  it('computes exponential backoff with jitter bounded between 0.8 and 1.2', () => {
    // With fixed random 0.5 (jitter = 1.0)
    const fixedRandom = () => 0.5;

    // Retry 0: base 30s * 2^0 = 30,000ms
    expect(computeBackoff(0, fixedRandom)).toBe(30_000);

    // Retry 1: 30s * 2^1 = 60,000ms
    expect(computeBackoff(1, fixedRandom)).toBe(60_000);

    // Retry 2: 30s * 2^2 = 120,000ms
    expect(computeBackoff(2, fixedRandom)).toBe(120_000);

    // Large retry count capped at 1,800,000ms (30 mins)
    expect(computeBackoff(10, fixedRandom)).toBe(1_800_000);
  });

  it('classifies 429 rate limit into a pause decision with until timestamp', () => {
    const error: AppError = {
      code: 'NOTION_RATE_LIMIT',
      message: 'Rate limit exceeded',
      retryable: true,
      detail: { retryAfterSec: 20 },
    };

    const before = Date.now();
    const decision = classify(error, 0);
    const after = Date.now();

    expect(decision.kind).toBe('pause');
    if (decision.kind === 'pause') {
      expect(decision.until).toBeGreaterThanOrEqual(before + 20_000);
      expect(decision.until).toBeLessThanOrEqual(after + 20_000);
    }
  });

  it('classifies 401 token invalidation into pause with reauth_required', () => {
    const error: AppError = {
      code: 'NOTION_AUTH',
      message: 'Token revoked',
      retryable: false,
    };

    const decision = classify(error, 0);
    expect(decision).toEqual({
      kind: 'pause',
      status: 'reauth_required',
    });
  });

  it('classifies 404 missing database into pause with rebind_required', () => {
    const error: AppError = {
      code: 'NOTION_NOT_FOUND',
      message: 'Database not found',
      retryable: false,
    };

    const decision = classify(error, 0);
    expect(decision).toEqual({
      kind: 'pause',
      status: 'rebind_required',
    });
  });

  it('retries recoverable network / server errors with backoff', () => {
    const error: AppError = {
      code: 'NOTION_NETWORK',
      message: 'Connection failed',
      retryable: true,
    };

    const decision = classify(error, 1, () => 0.5);
    expect(decision.kind).toBe('retry');
    if (decision.kind === 'retry') {
      expect(decision.delayMs).toBe(60_000);
    }
  });

  it('marks as fail when retryCount exceeds MAX_RETRY_COUNT', () => {
    const error: AppError = {
      code: 'NOTION_NETWORK',
      message: 'Persistent connection error',
      retryable: true,
    };

    const decision = classify(error, MAX_RETRY_COUNT);
    expect(decision.kind).toBe('fail');
  });
});
