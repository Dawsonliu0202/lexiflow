import type { Deps } from './types';

export function createSetSiteDisabledUseCase(deps: Deps) {
  return async function setSiteDisabled(host: string, disabled: boolean): Promise<void> {
    const list = (await deps.storage.get('disabledHosts')) || [];
    const normalizedHost = host.trim().toLowerCase();
    const set = new Set(list.map((h) => h.toLowerCase()));

    if (disabled) {
      set.add(normalizedHost);
    } else {
      set.delete(normalizedHost);
    }

    await deps.storage.set('disabledHosts', Array.from(set));
  };
}
