import type { PlatformAdapter } from './types';
import { LexiFlowError } from '../shared/errors';

export const chromePlatform: PlatformAdapter = {
  alarms: {
    async create(name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): Promise<void> {
      if (typeof chrome !== 'undefined' && chrome.alarms) {
        chrome.alarms.create(name, alarmInfo);
      }
    },
    async get(name: string): Promise<chrome.alarms.Alarm | undefined> {
      if (typeof chrome !== 'undefined' && chrome.alarms) {
        return await chrome.alarms.get(name);
      }
      return undefined;
    },
    async clear(name: string): Promise<boolean> {
      if (typeof chrome !== 'undefined' && chrome.alarms) {
        return await chrome.alarms.clear(name);
      }
      return false;
    },
  },

  identity: {
    async launchWebAuthFlow(details: chrome.identity.WebAuthFlowDetails): Promise<string> {
      if (typeof chrome === 'undefined' || !chrome.identity?.launchWebAuthFlow) {
        throw new LexiFlowError('NOTION_AUTH', 'chrome.identity API 不可用');
      }
      return new Promise<string>((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(details, (redirectUrl) => {
          if (chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || '';
            if (msg.includes('user did not approve') || msg.includes('canceled') || msg.includes('cancelled')) {
              reject(new LexiFlowError('OAUTH_CANCELLED', '用户取消了授权'));
            } else {
              reject(new LexiFlowError('NOTION_AUTH', msg));
            }
            return;
          }
          if (!redirectUrl) {
            reject(new LexiFlowError('OAUTH_CANCELLED', '未能获取到授权回调地址'));
            return;
          }
          resolve(redirectUrl);
        });
      });
    },

    getRedirectURL(path = 'notion'): string {
      if (typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL) {
        return chrome.identity.getRedirectURL(path);
      }
      return `https://pdpheceghiamfpeginbhipphblndkkab.chromiumapp.org/${path}`;
    },
  },

  permissions: {
    async request(permissions: chrome.permissions.Permissions): Promise<boolean> {
      if (typeof chrome !== 'undefined' && chrome.permissions?.request) {
        return await chrome.permissions.request(permissions);
      }
      return true;
    },
    async contains(permissions: chrome.permissions.Permissions): Promise<boolean> {
      if (typeof chrome !== 'undefined' && chrome.permissions?.contains) {
        return await chrome.permissions.contains(permissions);
      }
      return true;
    },
  },

  tabs: {
    async query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
      if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
        return await chrome.tabs.query(queryInfo);
      }
      return [];
    },
    async sendMessage<M, R>(tabId: number, message: M): Promise<R> {
      if (typeof chrome !== 'undefined' && chrome.tabs?.sendMessage) {
        return (await chrome.tabs.sendMessage(tabId, message)) as R;
      }
      return undefined as unknown as R;
    },
  },
};
