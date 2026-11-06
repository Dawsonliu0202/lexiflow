<template>
  <div class="rounded-xl border border-[#e8e8e4] bg-white p-6 shadow-sm space-y-4">
    <div class="flex items-center gap-3">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef0fb] text-[#3b4cca]">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
        </svg>
      </div>
      <div>
        <h3 class="text-sm font-bold text-[#1c1c1a]">AI 接口配置</h3>
        <p class="text-xs text-[#97978f]">兼容 OpenAI Chat Completions 协议的接口服务</p>
      </div>
    </div>

    <div class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-[#5f5f5a] mb-1">Base URL</label>
        <input
          v-model="aiConfig.baseUrl"
          type="text"
          placeholder="https://api.openai.com/v1"
          class="w-full rounded-lg border border-[#e8e8e4] px-3 py-1.5 text-xs text-[#1c1c1a] focus:border-[#3b4cca] focus:outline-none focus:ring-1 focus:ring-[#3b4cca]"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-[#5f5f5a] mb-1">API Key</label>
        <div class="flex gap-2">
          <input
            v-model="aiConfig.apiKey"
            :type="showKey ? 'text' : 'password'"
            placeholder="sk-..."
            class="flex-1 rounded-lg border border-[#e8e8e4] px-3 py-1.5 text-xs text-[#1c1c1a] focus:border-[#3b4cca] focus:outline-none focus:ring-1 focus:ring-[#3b4cca]"
          />
          <button
            type="button"
            class="rounded-lg border border-[#e8e8e4] px-3 py-1.5 text-xs text-[#5f5f5a] hover:bg-[#f7f7f5]"
            @click="showKey = !showKey"
          >
            {{ showKey ? '隐藏' : '显示' }}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label class="block text-xs font-medium text-[#5f5f5a] mb-1">模型名称</label>
          <input
            v-model="aiConfig.model"
            type="text"
            placeholder="gpt-4o-mini"
            class="w-full rounded-lg border border-[#e8e8e4] px-3 py-1.5 text-xs text-[#1c1c1a] focus:border-[#3b4cca] focus:outline-none focus:ring-1 focus:ring-[#3b4cca]"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-[#5f5f5a] mb-1">温度 (Temperature)</label>
          <input
            v-model.number="aiConfig.temperature"
            type="number"
            step="0.1"
            min="0"
            max="2"
            class="w-full rounded-lg border border-[#e8e8e4] px-3 py-1.5 text-xs text-[#1c1c1a] focus:border-[#3b4cca] focus:outline-none focus:ring-1 focus:ring-[#3b4cca]"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-[#5f5f5a] mb-1">目标语言</label>
          <input
            v-model="aiConfig.targetLang"
            type="text"
            placeholder="简体中文"
            class="w-full rounded-lg border border-[#e8e8e4] px-3 py-1.5 text-xs text-[#1c1c1a] focus:border-[#3b4cca] focus:outline-none focus:ring-1 focus:ring-[#3b4cca]"
          />
        </div>
      </div>

      <div class="flex items-center gap-3 pt-2">
        <button
          type="button"
          class="rounded-lg bg-[#3b4cca] px-4 py-2 text-xs font-medium text-white hover:bg-[#2f3eaa] disabled:opacity-50 transition-colors"
          :disabled="isSaving"
          @click="save"
        >
          {{ isSaving ? '保存中...' : '保存配置' }}
        </button>

        <button
          type="button"
          class="rounded-lg border border-[#e8e8e4] bg-white px-4 py-2 text-xs font-medium text-[#1c1c1a] hover:bg-[#f7f7f5] disabled:opacity-50 transition-colors"
          :disabled="isTesting || !aiConfig.apiKey"
          @click="test"
        >
          {{ isTesting ? '测试中...' : '测试连接' }}
        </button>

        <span v-if="saveMessage" class="text-xs text-[#2f7d57] font-medium">
          {{ saveMessage }}
        </span>
      </div>

      <!-- Test result feedback -->
      <div
        v-if="testResult"
        class="mt-2 rounded-lg p-3 text-xs"
        :class="testResult.ok ? 'bg-[#e8f3ed] text-[#2f7d57]' : 'bg-[#fbebe9] text-[#b3382c]'"
      >
        <span v-if="testResult.ok">✓ 连接成功 (耗时: {{ testResult.ms }}ms)</span>
        <span v-else>✗ 连接失败: {{ testResult.error }} (耗时: {{ testResult.ms }}ms)</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import type { AiConfig } from '../../../shared/types';
import { storage, DEFAULT_AI_CONFIG } from '../../../shared/storage';
import { requestRpc } from '../../../messaging/client';
import { chromePlatform } from '../../../platform/chrome';

const aiConfig = reactive<AiConfig>({ ...DEFAULT_AI_CONFIG });
const showKey = ref(false);
const isSaving = ref(false);
const isTesting = ref(false);
const saveMessage = ref('');
const testResult = ref<{ ok: boolean; ms: number; error?: string } | null>(null);

onMounted(async () => {
  const saved = await storage.get('aiConfig');
  if (saved) {
    Object.assign(aiConfig, saved);
  }
});

async function save() {
  isSaving.value = true;
  saveMessage.value = '';
  testResult.value = null;

  try {
    // If URL is https or valid, request optional origin permissions
    const rawUrl = aiConfig.baseUrl.trim();
    if (rawUrl) {
      try {
        const u = new URL(rawUrl);
        const origin = `${u.protocol}//${u.host}/*`;
        await chromePlatform.permissions.request({ origins: [origin] });
      } catch {
        // Continue
      }
    }

    await storage.set('aiConfig', { ...aiConfig });
    saveMessage.value = '✓ 配置已保存';
    setTimeout(() => {
      saveMessage.value = '';
    }, 2500);
  } finally {
    isSaving.value = false;
  }
}

async function test() {
  isTesting.value = true;
  testResult.value = null;

  try {
    const res = await requestRpc('TEST_AI', { ...aiConfig });
    testResult.value = res;
  } catch (err) {
    testResult.value = {
      ok: false,
      ms: 0,
      error: (err as Error).message || '请求失败',
    };
  } finally {
    isTesting.value = false;
  }
}
</script>
