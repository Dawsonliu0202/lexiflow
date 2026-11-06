<template>
  <div class="flex items-center gap-2.5 py-2 border-b border-[#f0f0ec] last:border-b-0 hover:bg-[#fafaf8] px-2 rounded-lg transition-colors">
    <div class="flex-1 min-w-0">
      <div class="flex items-baseline gap-1.5 truncate">
        <span class="font-semibold text-xs text-[#1c1c1a]">{{ word.lemma }}</span>
        <span v-if="word.word !== word.lemma" class="text-[11px] text-[#97978f]">({{ word.word }})</span>
        <span v-if="word.count > 1" class="text-[10px] text-[#2f7d57] font-medium bg-[#e8f3ed] px-1 rounded">
          ×{{ word.count }}
        </span>
      </div>
      <div class="text-[11px] text-[#5f5f5a] truncate mt-0.5" :title="word.contextMeaning">
        {{ word.contextMeaning }}
      </div>
    </div>

    <div class="flex items-center gap-1.5 flex-none">
      <SyncBadge :status="word.syncStatus" :last-error="word.lastError" />
      <button
        v-if="word.syncStatus === 'failed' || word.syncStatus === 'pending'"
        type="button"
        class="text-[11px] text-[#3b4cca] hover:underline px-1 py-0.5 rounded"
        @click="$emit('retry', word.id)"
      >
        重试
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Word } from '../shared/types';
import SyncBadge from './SyncBadge.vue';

defineProps<{
  word: Word;
}>();

defineEmits<{
  (e: 'retry', id?: number): void;
}>();
</script>
