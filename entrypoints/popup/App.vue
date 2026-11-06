<template>
  <div class="w-[364px] min-h-[460px] bg-white text-[#1c1c1a] font-sans text-xs flex flex-col shadow-sm">
    <!-- Header -->
    <div class="flex items-center gap-2 border-b border-[#f0f0ec] px-4 py-3 font-semibold bg-[#fafaf8]">
      <img src="/icon/32.png" alt="LexiFlow AI" class="h-5 w-5 rounded-md shadow-xs" />
      <span class="text-sm tracking-tight text-[#1c1c1a]">LexiFlow AI</span>
      <span class="rounded bg-[#eef0fb] px-1.5 py-0.5 text-[10px] font-medium text-[#3b4cca]">语境词汇</span>
      <button
        type="button"
        class="ml-auto text-[#97978f] hover:text-[#1c1c1a] transition-colors p-1 rounded"
        title="打开设置"
        @click="openOptions"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
      </button>
    </div>

    <!-- Warning banner if AI unconfigured or Notion needs attention -->
    <div
      v-if="warningMessage"
      class="bg-[#faf1de] px-4 py-2 text-xs text-[#9a6a14] cursor-pointer hover:underline border-b border-[#f0f0ec]"
      @click="openOptions"
    >
      {{ warningMessage }}
    </div>

    <!-- Section: Search / Query -->
    <div class="border-b border-[#f0f0ec] p-4 space-y-2">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <input
            v-model="queryWord"
            type="text"
            placeholder="输入单词或短语，回车查询"
            class="w-full rounded-lg border border-[#e8e8e4] bg-[#f7f7f5] px-3 py-1.5 pl-8 text-xs focus:bg-white focus:border-[#3b4cca] focus:outline-none transition-colors"
            @keyup.enter="handleQuery"
          />
          <svg class="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#97978f]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </div>
        <button
          type="button"
          class="rounded-lg bg-[#3b4cca] px-3 py-1.5 font-medium text-white hover:bg-[#2f3eaa] disabled:opacity-50 transition-colors"
          :disabled="!queryWord.trim() || isSearching"
          @click="handleQuery"
        >
          {{ isSearching ? '查询中' : '查询' }}
        </button>
      </div>

      <!-- Optional Context Input -->
      <details class="text-[11px] text-[#97978f] cursor-pointer">
        <summary class="hover:text-[#5f5f5a]">添加语境句（可选）</summary>
        <input
          v-model="querySentence"
          type="text"
          placeholder="粘贴包含该词的句子，AI 将给出针对该句的精准释义"
          class="mt-2 w-full rounded-lg border border-[#e8e8e4] bg-[#f7f7f5] px-2.5 py-1 text-xs text-[#1c1c1a] focus:bg-white focus:border-[#3b4cca] focus:outline-none"
        />
      </details>

      <!-- Search Result Preview -->
      <div v-if="searchResult || searchPartial || searchError" class="mt-2 rounded-lg border border-[#e8e8e4] p-3 bg-[#fafaf8] space-y-2">
        <div v-if="searchError" class="text-xs text-[#b3382c]">{{ searchError.message }}</div>
        <template v-else>
          <div class="flex items-baseline justify-between">
            <span class="font-bold text-sm text-[#1c1c1a]">{{ activeResultWord }}</span>
            <span class="text-xs text-[#97978f]">{{ activeResultPhonetic }}</span>
          </div>
          <div class="rounded bg-[#eef0fb] p-2 text-xs font-medium text-[#232f9e]">
            {{ activeResultMeaning }}
          </div>
          <div v-if="activeResultCore.length > 0" class="text-[11px] text-[#5f5f5a] space-y-0.5">
            <div v-for="(m, i) in activeResultCore" :key="i">{{ m }}</div>
          </div>
          <div class="flex items-center justify-between pt-1">
            <button
              type="button"
              class="rounded bg-[#3b4cca] px-3 py-1 text-xs text-white hover:bg-[#2f3eaa] disabled:opacity-50"
              :disabled="savedSearch || !searchResult"
              @click="saveSearchResult"
            >
              {{ savedSearch ? '✓ 已收藏' : '加入生词本' }}
            </button>
            <button
              type="button"
              class="text-xs text-[#97978f] hover:text-[#1c1c1a]"
              @click="clearSearch"
            >
              清空
            </button>
          </div>
        </template>
      </div>
    </div>

    <!-- Section: Recent Vocabulary -->
    <div class="flex-1 p-4 space-y-2 overflow-y-auto">
      <div class="flex items-center justify-between">
        <h4 class="text-[10px] font-semibold tracking-wider text-[#97978f] uppercase">
          最近收藏 ({{ recentWords.length }})
        </h4>
        <button
          v-if="hasFailedOrPending"
          type="button"
          class="rounded px-2 py-0.5 text-[11px] text-[#3b4cca] hover:bg-[#eef0fb] transition-colors"
          @click="handleRetryAll"
        >
          全部重试
        </button>
      </div>

      <div v-if="recentWords.length === 0" class="py-6 text-center text-xs text-[#97978f]">
        暂无收藏词汇，在网页中划词即可采集
      </div>

      <div v-else class="space-y-0.5">
        <WordListItem
          v-for="item in recentWords"
          :key="item.id"
          :word="item"
          @retry="handleRetrySingle"
        />
      </div>
    </div>

    <!-- Section: Current Site Toggle -->
    <div class="border-t border-[#f0f0ec] p-3 px-4 bg-[#fafaf8]">
      <div class="flex items-center justify-between">
        <div class="min-w-0 pr-2">
          <div class="text-xs font-semibold text-[#1c1c1a] truncate" :title="currentHost">
            {{ currentHost || '本地页面' }}
          </div>
          <div class="text-[11px] text-[#97978f]">
            在此站点禁用划词
          </div>
        </div>

        <!-- Toggle Switch -->
        <button
          type="button"
          role="switch"
          :aria-checked="isCurrentHostDisabled"
          :disabled="!currentHost"
          class="relative inline-flex h-5 w-9 flex-none cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-40"
          :class="isCurrentHostDisabled ? 'bg-[#3b4cca]' : 'bg-[#dcdcd6]'"
          @click="toggleSiteDisabled"
        >
          <span
            class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            :class="isCurrentHostDisabled ? 'translate-x-4' : 'translate-x-0'"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { liveQuery } from 'dexie';
import type { Word, AiWordEntry, AppStatus } from '../../shared/types';
import type { AppError } from '../../shared/errors';
import { wordRepo } from '../../db/wordRepo';
import { requestRpc, openTranslateStream } from '../../messaging/client';
import { partialParse } from '../../services/ai/parse';
import WordListItem from '../../components/WordListItem.vue';

const queryWord = ref('');
const querySentence = ref('');
const isSearching = ref(false);
const searchResult = ref<AiWordEntry | null>(null);
const searchPartial = ref<Partial<AiWordEntry> | null>(null);
const searchError = ref<AppError | null>(null);
const savedSearch = ref(false);

const recentWords = ref<Word[]>([]);
const appStatus = ref<AppStatus | null>(null);
const currentHost = ref('');
const isCurrentHostDisabled = ref(false);

const warningMessage = computed(() => {
  if (!appStatus.value?.aiConfigured) {
    return '⚠️ 尚未配置 AI 接口，点击前往设置';
  }
  if (appStatus.value?.notionStatus === 'reauth_required') {
    return '⚠️ Notion 授权失效，点击重新连接';
  }
  if (appStatus.value?.notionStatus === 'rebind_required') {
    return '⚠️ Notion 数据库未绑定，点击前往绑定';
  }
  return '';
});

const activeResultWord = computed(() => searchResult.value?.word || searchPartial.value?.word || queryWord.value);
const activeResultPhonetic = computed(() => searchResult.value?.phonetic || searchPartial.value?.phonetic || '');
const activeResultMeaning = computed(() => searchResult.value?.contextMeaning || searchPartial.value?.contextMeaning || '解析中...');
const activeResultCore = computed(() => searchResult.value?.coreMeanings || searchPartial.value?.coreMeanings || []);

const hasFailedOrPending = computed(() => {
  return recentWords.value.some((w) => w.syncStatus === 'failed' || w.syncStatus === 'pending');
});

async function refreshWords() {
  recentWords.value = await wordRepo.recent(10);
}

async function refreshStatus() {
  try {
    appStatus.value = await requestRpc('GET_STATUS', undefined);
  } catch {
    // Ignore
  }
}

async function initTabAndHost() {
  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.url) {
      try {
        const urlObj = new URL(tabs[0].url);
        if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
          currentHost.value = urlObj.hostname;
          const res = await requestRpc('GET_SITE_DISABLED', { host: currentHost.value });
          isCurrentHostDisabled.value = res.disabled;
        }
      } catch {
        // Not a standard URL
      }
    }
  }
}

async function toggleSiteDisabled() {
  if (!currentHost.value) return;
  const nextVal = !isCurrentHostDisabled.value;
  isCurrentHostDisabled.value = nextVal;
  await requestRpc('SET_SITE_DISABLED', { host: currentHost.value, disabled: nextVal });

  // Broadcast to current tab
  if (typeof chrome !== 'undefined' && chrome.tabs?.query) {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SITE_TOGGLED',
        host: currentHost.value,
        disabled: nextVal,
      }).catch(() => {});
    }
  }
}

function handleQuery() {
  const word = queryWord.value.trim();
  if (!word || isSearching.value) return;

  isSearching.value = true;
  searchResult.value = null;
  searchPartial.value = null;
  searchError.value = null;
  savedSearch.value = false;

  openTranslateStream(
    {
      word,
      sentence: querySentence.value.trim(),
      pageTitle: 'Popup Search',
      pageUrl: 'popup',
    },
    {
      onChunk(text) {
        searchPartial.value = partialParse(text);
      },
      onDone(entry) {
        isSearching.value = false;
        searchResult.value = entry;
      },
      onError(err) {
        isSearching.value = false;
        searchError.value = err;
      },
    }
  );
}

async function saveSearchResult() {
  if (!searchResult.value) return;
  try {
    await requestRpc('SAVE_WORD', {
      entry: searchResult.value,
      context: {
        sentence: querySentence.value.trim(),
        pageTitle: 'Popup Manual',
        pageUrl: 'popup',
      },
    });
    savedSearch.value = true;
    await refreshWords();
  } catch (err) {
    console.error('Failed to save popup query:', err);
  }
}

function clearSearch() {
  queryWord.value = '';
  querySentence.value = '';
  searchResult.value = null;
  searchPartial.value = null;
  searchError.value = null;
  savedSearch.value = false;
}

async function handleRetrySingle(id?: number) {
  if (id === undefined) return;
  await requestRpc('SYNC_RETRY', { id });
  await refreshWords();
}

async function handleRetryAll() {
  await requestRpc('SYNC_NOW', undefined);
  await refreshWords();
}

function openOptions() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
}

onMounted(async () => {
  await refreshWords();
  await refreshStatus();
  await initTabAndHost();

  // Reactive subscription via Dexie liveQuery
  const subscription = liveQuery(() => wordRepo.recent(10)).subscribe({
    next: (words) => {
      recentWords.value = words;
    },
  });

  onUnmounted(() => {
    subscription.unsubscribe();
  });
});
</script>
