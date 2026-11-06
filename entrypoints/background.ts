import { defineBackground } from 'wxt/sandbox';
import { wordRepo } from '../db/wordRepo';
import { storage } from '../shared/storage';
import { aiClient } from '../services/ai/client';
import { notionGateway } from '../services/notion/gateway';
import { syncEngine } from '../services/sync/queue';
import { setupMessageRouter } from '../messaging/router';
import type { Deps } from '../usecases/types';
import { log } from '../shared/log';

export default defineBackground(() => {
  log.info('background', 'LexiFlow AI Service Worker initialized');

  const deps: Deps = {
    db: wordRepo,
    storage,
    ai: aiClient,
    notion: notionGateway,
    sync: syncEngine,
  };

  // 1. Synchronously register message & port router
  setupMessageRouter(deps);

  // 2. Synchronously register extension install / update lifecycle
  if (typeof chrome !== 'undefined' && chrome.runtime?.onInstalled) {
    chrome.runtime.onInstalled.addListener(async () => {
      log.info('background', 'Extension installed or updated');

      // Set storage access level so Content Script cannot access local storage directly
      try {
        if ('setAccessLevel' in chrome.storage.local) {
          await chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
        }
      } catch (err) {
        log.warn('background', 'Failed to set storage access level:', err);
      }

      // Try to request persistent storage
      try {
        if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
          await navigator.storage.persist();
        }
      } catch {
        // Ignore
      }

      // Create recurring sync alarm (period: 1 min)
      if (chrome.alarms) {
        const existingAlarm = await chrome.alarms.get('sync');
        if (!existingAlarm) {
          chrome.alarms.create('sync', { periodInMinutes: 1 });
        }
      }
    });
  }

  // 3. Synchronously register browser startup
  if (typeof chrome !== 'undefined' && chrome.runtime?.onStartup) {
    chrome.runtime.onStartup.addListener(async () => {
      log.info('background', 'Browser startup: rolling back stuck words and triggering sync');
      await wordRepo.resetStuckSyncing(5 * 60 * 1000);
      syncEngine.kick().catch((e) => log.error('background', 'Startup sync error:', e));
    });
  }

  // 4. Synchronously register alarms
  if (typeof chrome !== 'undefined' && chrome.alarms?.onAlarm) {
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'sync') {
        log.debug('background', 'Sync alarm triggered');
        syncEngine.kick().catch((e) => log.error('background', 'Alarm sync error:', e));
      }
    });
  }
});
