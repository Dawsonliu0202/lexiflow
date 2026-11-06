<template>
  <div class="rounded-xl border border-[#e8e8e4] bg-white p-6 shadow-sm space-y-4">
    <div class="flex items-center gap-3">
      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#eef0fb] text-[#3b4cca]">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
        </svg>
      </div>
      <div>
        <h3 class="text-sm font-bold text-[#1c1c1a]">本地词库与备份</h3>
        <p class="text-xs text-[#97978f]">离线存储保障，支持导出结构化 JSON 与 Excel CSV</p>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="grid grid-cols-3 gap-3">
      <div class="rounded-lg bg-[#f7f7f5] p-3 text-center">
        <div class="text-xl font-bold text-[#1c1c1a]">{{ stats.total }}</div>
        <div class="text-[11px] text-[#97978f]">全部词条</div>
      </div>
      <div class="rounded-lg bg-[#f7f7f5] p-3 text-center">
        <div class="text-xl font-bold text-[#9a6a14]">{{ stats.pending }}</div>
        <div class="text-[11px] text-[#97978f]">待同步</div>
      </div>
      <div class="rounded-lg bg-[#f7f7f5] p-3 text-center">
        <div class="text-xl font-bold text-[#b3382c]">{{ stats.failed }}</div>
        <div class="text-[11px] text-[#97978f]">同步失败</div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3 pt-2">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-[#3b4cca] px-4 py-2 text-xs font-medium text-white hover:bg-[#2f3eaa] transition-colors"
        @click="exportJson"
      >
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        导出完整 JSON
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg border border-[#e8e8e4] bg-white px-4 py-2 text-xs font-medium text-[#1c1c1a] hover:bg-[#f7f7f5] transition-colors"
        @click="exportCsv"
      >
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        导出 Excel CSV
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg border border-[#e8e8e4] bg-white px-3 py-2 text-xs font-medium text-[#5f5f5a] hover:bg-[#f7f7f5] transition-colors ml-auto"
        :disabled="isSyncing"
        @click="triggerSync"
      >
        {{ isSyncing ? '同步中...' : '立即同步' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { wordRepo } from '../../../db/wordRepo';
import { requestRpc } from '../../../messaging/client';
import {
  exportWordsToJson,
  exportWordsToCsv,
  getExportFilename,
  triggerDownload,
} from '../../../services/export';

const stats = ref({ total: 0, pending: 0, failed: 0, synced: 0 });
const isSyncing = ref(false);

async function refreshStats() {
  stats.value = await wordRepo.stats();
}

onMounted(() => {
  refreshStats();
});

async function exportJson() {
  const words = await wordRepo.exportAll();
  const json = exportWordsToJson(words);
  triggerDownload(json, getExportFilename('json'), 'application/json');
}

async function exportCsv() {
  const words = await wordRepo.exportAll();
  const csv = exportWordsToCsv(words);
  triggerDownload(csv, getExportFilename('csv'), 'text/csv;charset=utf-8;');
}

async function triggerSync() {
  isSyncing.value = true;
  try {
    await requestRpc('SYNC_NOW', undefined);
    await refreshStats();
  } finally {
    isSyncing.value = false;
  }
}
</script>
