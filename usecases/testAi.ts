import type { Deps } from './types';
import type { AiConfig } from '../shared/types';

export function createTestAiUseCase(deps: Deps) {
  return async function testAi(cfg: AiConfig): Promise<{ ok: boolean; ms: number; error?: string }> {
    return await deps.ai.testConnection(cfg);
  };
}
