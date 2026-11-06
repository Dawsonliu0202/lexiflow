import type { Deps } from './types';
import { log } from '../shared/log';

export function createDisconnectNotionUseCase(deps: Deps) {
  return async function disconnectNotion(): Promise<void> {
    await deps.storage.remove('notionAuth');
    await deps.storage.remove('notionBinding');
    await deps.storage.set('notionStatus', 'disconnected');
    await deps.storage.remove('pausedUntil');
    log.info('usecase:disconnectNotion', 'Disconnected Notion workspace');
  };
}
