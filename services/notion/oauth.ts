import type { NotionAuth, NotionAppConfig } from '../../shared/types';
import { LexiFlowError } from '../../shared/errors';
import { chromePlatform } from '../../platform/chrome';
import { createId } from '../../shared/utils';
import { NOTION_BASE_URL } from './api';

export async function launchOAuthFlow(appConfig: NotionAppConfig): Promise<NotionAuth> {
  const { clientId, clientSecret } = appConfig;
  if (!clientId || !clientSecret) {
    throw new LexiFlowError(
      'NOTION_NOT_CONFIGURED',
      '请先在设置页填写 Notion Client ID 与 Client Secret'
    );
  }

  const redirectUri = chromePlatform.identity.getRedirectURL('notion');
  const state = createId(16);

  const authUrl = `${NOTION_BASE_URL}/oauth/authorize?client_id=${encodeURIComponent(
    clientId.trim()
  )}&response_type=code&owner=user&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&state=${encodeURIComponent(state)}`;

  const responseUrl = await chromePlatform.identity.launchWebAuthFlow({
    url: authUrl,
    interactive: true,
  });

  const parsedUrl = new URL(responseUrl);
  const returnedState = parsedUrl.searchParams.get('state');
  const code = parsedUrl.searchParams.get('code');
  const error = parsedUrl.searchParams.get('error');

  if (error) {
    if (error === 'access_denied') {
      throw new LexiFlowError('OAUTH_CANCELLED', '用户取消了 Notion 授权');
    }
    throw new LexiFlowError('NOTION_AUTH', `Notion 授权失败: ${error}`);
  }

  if (!returnedState || returnedState !== state) {
    throw new LexiFlowError('OAUTH_STATE_MISMATCH', 'Notion 授权状态校验失败 (state mismatch)');
  }

  if (!code) {
    throw new LexiFlowError('NOTION_AUTH', '未能获取到 Notion 授权码');
  }

  return await exchangeToken(clientId.trim(), clientSecret.trim(), code, redirectUri);
}

export async function exchangeToken(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<NotionAuth> {
  const tokenUrl = `${NOTION_BASE_URL}/oauth/token`;
  const basicAuth = btoa(`${clientId}:${clientSecret}`);

  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    });
  } catch (err) {
    throw new LexiFlowError(
      'NOTION_NETWORK',
      `交换 Notion Token 失败: ${(err as Error).message}`
    );
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new LexiFlowError(
      'NOTION_AUTH',
      `Notion Token 交换失败 (${res.status}): ${errText.slice(0, 150)}`
    );
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    workspaceId: data.workspace_id,
    workspaceName: data.workspace_name || 'My Workspace',
    workspaceIcon: data.workspace_icon,
    botId: data.bot_id,
    connectedAt: Date.now(),
  };
}
