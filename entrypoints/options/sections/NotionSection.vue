<template>
  <div class="rounded-xl border border-[#e8e8e4] bg-white p-6 shadow-sm space-y-4">
    <div class="flex items-center gap-3">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef0fb] text-[#3b4cca]">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      </div>
      <div>
        <h3 class="text-sm font-bold text-[#1c1c1a]">Notion 同步</h3>
        <p class="text-xs text-[#97978f]">一键 OAuth 授权，全自动创建并绑定词汇数据库</p>
      </div>
      <div class="ml-auto">
        <span
          class="rounded-full px-2.5 py-0.5 text-xs font-medium"
          :class="statusBadgeClasses"
        >
          {{ statusLabel }}
        </span>
      </div>
    </div>

    <!-- Credentials Form -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <label class="block text-xs font-medium text-[#5f5f5a] mb-1">Client ID</label>
        <input
          v-model="notionApp.clientId"
          type="text"
          placeholder="从 Notion Developers 后台获取"
          class="w-full rounded-lg border border-[#e8e8e4] px-3 py-1.5 text-xs text-[#1c1c1a] focus:border-[#3b4cca] focus:outline-none"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-[#5f5f5a] mb-1">Client Secret</label>
        <input
          v-model="notionApp.clientSecret"
          type="password"
          placeholder="secret_..."
          class="w-full rounded-lg border border-[#e8e8e4] px-3 py-1.5 text-xs text-[#1c1c1a] focus:border-[#3b4cca] focus:outline-none"
        />
      </div>
    </div>

    <div>
      <label class="block text-xs font-medium text-[#5f5f5a] mb-1">
        Redirect URI (在 Notion 集成后台填写此地址)
      </label>
      <div class="flex gap-2">
        <input
          :value="redirectUri"
          type="text"
          readonly
          class="flex-1 min-w-0 rounded-lg border border-[#e8e8e4] bg-[#f7f7f5] px-3 py-1.5 text-xs text-[#5f5f5a] select-all cursor-default"
        />
        <button
          type="button"
          class="flex-none rounded-lg border border-[#e8e8e4] px-3 py-1.5 text-xs text-[#5f5f5a] hover:bg-[#f7f7f5]"
          @click="copyRedirectUri"
        >
          {{ copied ? '已复制' : '复制' }}
        </button>
      </div>
    </div>

    <!-- Connection Info (if connected) -->
    <div
      v-if="status === 'connected' && notionAuth"
      class="rounded-lg bg-[#f7f7f5] p-3 text-xs space-y-1 text-[#5f5f5a]"
    >
      <div class="flex items-center justify-between">
        <span>已授权工作区:</span>
        <span class="font-semibold text-[#1c1c1a]">{{ notionAuth.workspaceName }}</span>
      </div>
      <div v-if="notionBinding" class="flex items-center justify-between">
        <span>绑定的数据库:</span>
        <a
          :href="notionBinding.databaseUrl"
          target="_blank"
          class="text-[#3b4cca] hover:underline flex items-center gap-1"
        >
          LexiFlow Vocabulary
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3 pt-1">
      <button
        v-if="status !== 'connected'"
        type="button"
        class="rounded-lg bg-[#3b4cca] px-4 py-2 text-xs font-medium text-white hover:bg-[#2f3eaa] disabled:opacity-50 transition-colors"
        :disabled="isConnecting || !notionApp.clientId || !notionApp.clientSecret"
        @click="connect"
      >
        {{ isConnecting ? '连接中...' : '连接 Notion' }}
      </button>

      <template v-else>
        <button
          type="button"
          class="rounded-lg border border-[#e8e8e4] bg-white px-3 py-1.5 text-xs text-[#b3382c] hover:bg-[#fbebe9] transition-colors"
          @click="disconnect"
        >
          断开连接
        </button>
        <button
          type="button"
          class="rounded-lg border border-[#e8e8e4] bg-white px-3 py-1.5 text-xs text-[#5f5f5a] hover:bg-[#f7f7f5] transition-colors"
          :disabled="isConnecting"
          @click="connect"
        >
          重新检查并绑定
        </button>
      </template>

      <span v-if="actionError" class="text-xs text-[#b3382c]">
        {{ actionError }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import type { NotionAppConfig, NotionAuth, NotionBinding, NotionStatus } from '../../../shared/types';
import { storage, DEFAULT_NOTION_APP } from '../../../shared/storage';
import { chromePlatform } from '../../../platform/chrome';
import { requestRpc } from '../../../messaging/client';

const notionApp = reactive<NotionAppConfig>({ ...DEFAULT_NOTION_APP });
const notionAuth = ref<NotionAuth | null>(null);
const notionBinding = ref<NotionBinding | null>(null);
const status = ref<NotionStatus>('disconnected');

const isConnecting = ref(false);
const actionError = ref('');
const copied = ref(false);

const redirectUri = computed(() => chromePlatform.identity.getRedirectURL('notion'));

const statusLabel = computed(() => {
  switch (status.value) {
    case 'connected':
      return '已连接';
    case 'reauth_required':
      return '需重新授权';
    case 'rebind_required':
      return '需重新绑定';
    case 'schema_mismatch':
      return 'Schema 异常';
    default:
      return '未连接';
  }
});

const statusBadgeClasses = computed(() => {
  switch (status.value) {
    case 'connected':
      return 'bg-[#e8f3ed] text-[#2f7d57]';
    case 'reauth_required':
    case 'rebind_required':
    case 'schema_mismatch':
      return 'bg-[#faf1de] text-[#9a6a14]';
    default:
      return 'bg-gray-100 text-gray-600';
  }
});

onMounted(async () => {
  const app = await storage.get('notionApp');
  if (app) Object.assign(notionApp, app);

  notionAuth.value = (await storage.get('notionAuth')) || null;
  notionBinding.value = (await storage.get('notionBinding')) || null;
  status.value = (await storage.get('notionStatus')) || 'disconnected';
});

function copyRedirectUri() {
  navigator.clipboard.writeText(redirectUri.value).then(() => {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1800);
  });
}

async function connect() {
  isConnecting.value = true;
  actionError.value = '';

  try {
    // Save client config first
    await storage.set('notionApp', { ...notionApp });

    const result = await requestRpc('CONNECT_NOTION', undefined);
    if (result.ok) {
      status.value = 'connected';
      notionAuth.value = (await storage.get('notionAuth')) || null;
      notionBinding.value = (await storage.get('notionBinding')) || null;
    }
  } catch (err) {
    actionError.value = (err as Error).message || '连接失败';
  } finally {
    isConnecting.value = false;
  }
}

async function disconnect() {
  if (!confirm('确认断开 Notion 连接吗？本地生词本将完整保留。')) return;

  await requestRpc('DISCONNECT_NOTION', undefined);
  status.value = 'disconnected';
  notionAuth.value = null;
  notionBinding.value = null;
}
</script>
