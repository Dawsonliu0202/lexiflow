import type { Deps } from './types';
import { log } from '../shared/log';

export function createSyncNowUseCase(deps: Deps) {
  return async function syncNow(id?: number): Promise<{ queued: number }> {
    const resetCount = await deps.db.resetFailed(id);
    log.info('usecase:syncNow', `Reset ${resetCount} failed words for re-sync`);

    deps.sync.kick().catch((err) => {
      log.error('usecase:syncNow', 'Sync kick error:', err);
    });

    const stats = await deps.db.stats();
    return { queued: stats.pending };
  };
}
