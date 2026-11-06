import type { Deps } from './types';
import type { NotionConnectResult } from '../shared/types';
import { launchOAuthFlow } from '../services/notion/oauth';
import { ensureBinding } from '../services/notion/database';
import { log } from '../shared/log';

export function createConnectNotionUseCase(deps: Deps) {
  return async function connectNotion(): Promise<NotionConnectResult> {
    const appConfig = await deps.storage.get('notionApp');
    const auth = await launchOAuthFlow(appConfig);

    await deps.storage.set('notionAuth', auth);
    log.info('usecase:connectNotion', `OAuth successful for workspace: ${auth.workspaceName}`);

    // Ensure database binding (search or auto-create)
    const binding = await ensureBinding(auth.accessToken);
    await deps.storage.set('notionBinding', binding);
    await deps.storage.set('notionStatus', 'connected');
    await deps.storage.remove('pausedUntil');

    log.info('usecase:connectNotion', `Database bound: ${binding.databaseId}`);

    // Trigger initial queue sync
    deps.sync.kick().catch((err) => {
      log.error('usecase:connectNotion', 'Initial sync kick error:', err);
    });

    return {
      ok: true,
      workspaceName: auth.workspaceName,
      databaseId: binding.databaseId,
      databaseUrl: binding.databaseUrl,
    };
  };
}
