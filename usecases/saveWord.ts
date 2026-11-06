import type { Deps } from './types';
import type { AiWordEntry, WordContextInput } from '../shared/types';
import { log } from '../shared/log';

export function createSaveWordUseCase(deps: Deps) {
  return async function saveWord(
    entry: AiWordEntry,
    context: WordContextInput
  ): Promise<{ count: number; isNew: boolean }> {
    const res = await deps.db.saveOrIncrement(entry, context);
    log.info('usecase:saveWord', `Saved '${entry.lemma}' (count: ${res.count}, isNew: ${res.isNew})`);

    // Kick sync asynchronously without awaiting
    deps.sync.kick().catch((err) => {
      log.error('usecase:saveWord', 'Background sync kick error:', err);
    });

    return res;
  };
}
