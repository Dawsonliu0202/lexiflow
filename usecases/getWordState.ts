import type { Deps } from './types';

export function createGetWordStateUseCase(deps: Deps) {
  return async function getWordState(lemma: string): Promise<{ exists: boolean; count: number }> {
    const word = await deps.db.findByLemma(lemma);
    if (!word) {
      return { exists: false, count: 0 };
    }
    return { exists: true, count: word.count };
  };
}
