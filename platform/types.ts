export interface PlatformAdapter {
  alarms: {
    create(name: string, alarmInfo: chrome.alarms.AlarmCreateInfo): Promise<void>;
    get(name: string): Promise<chrome.alarms.Alarm | undefined>;
    clear(name: string): Promise<boolean>;
  };
  identity: {
    launchWebAuthFlow(details: chrome.identity.WebAuthFlowDetails): Promise<string>;
    getRedirectURL(path?: string): string;
  };
  permissions: {
    request(permissions: chrome.permissions.Permissions): Promise<boolean>;
    contains(permissions: chrome.permissions.Permissions): Promise<boolean>;
  };
  tabs: {
    query(queryInfo: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]>;
    sendMessage<M, R>(tabId: number, message: M): Promise<R>;
  };
}
