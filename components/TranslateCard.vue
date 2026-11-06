<template>
  <div
    class="lexi-card fixed z-[2147483647] w-[356px] rounded-2xl bg-white p-0 text-left font-sans text-xs leading-relaxed text-[#1c1c1a] shadow-[0_12px_40px_rgba(20,20,10,0.14),0_2px_6px_rgba(20,20,10,0.06)] border border-[#e8e8e4]"
    :style="{ left: `${position.x}px`, top: `${position.y}px` }"
    @mousedown.stop
    @mouseup.stop
    @keydown.stop
  >
    <!-- Header (Draggable) -->
    <div
      class="flex cursor-move items-baseline gap-2.5 border-b border-[#f0f0ec] px-4 py-3 select-none"
      @mousedown="startDrag"
    >
      <div class="flex items-baseline gap-2 flex-1 min-w-0">
        <span class="text-lg font-bold tracking-tight text-[#1c1c1a] truncate">
          {{ displayWord }}
        </span>
        <span v-if="displayPhonetic" class="text-xs text-[#97978f] font-normal">
          {{ displayPhonetic }}
        </span>
      </div>
      <button
        type="button"
        class="flex h-6 w-6 items-center justify-center rounded text-[#97978f] hover:bg-[#f0f0ec] hover:text-[#1c1c1a] transition-colors"
        title="关闭 (Esc)"
        @click="$emit('close')"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Body -->
    <div class="max-h-[360px] overflow-y-auto px-4 py-3 space-y-3">
      <!-- Seen before badge -->
      <div v-if="savedCount > 0" class="flex items-center gap-1.5 text-xs text-[#2f7d57] font-medium">
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span>已收藏 {{ savedCount }} 次</span>
      </div>

      <!-- Error State -->
      <div v-if="state === 'error'" class="rounded-lg bg-[#fbebe9] p-3 text-xs text-[#b3382c] space-y-2">
        <p class="font-medium">{{ error?.message || '解析失败，请检查配置或重试' }}</p>
        <div class="flex gap-2">
          <button
            v-if="error?.code === 'AI_NOT_CONFIGURED'"
            type="button"
            class="rounded bg-[#3b4cca] px-3 py-1 text-white hover:bg-[#2f3eaa]"
            @click="$emit('openOptions')"
          >
            打开设置
          </button>
          <button
            v-else
            type="button"
            class="rounded bg-white border border-[#b3382c] px-2.5 py-1 text-[#b3382c] hover:bg-[#fbebe9]"
            @click="$emit('retry')"
          >
            重试
          </button>
        </div>
      </div>

      <!-- Loading skeleton when no partial text yet -->
      <div v-else-if="state === 'loading' && !displayContextMeaning" class="space-y-2 py-2">
        <div class="h-4 w-3/4 rounded bg-gradient-to-r from-[#eeeeea] via-[#f6f6f3] to-[#eeeeea] animate-pulse"></div>
        <div class="h-3 w-full rounded bg-gradient-to-r from-[#eeeeea] via-[#f6f6f3] to-[#eeeeea] animate-pulse"></div>
        <div class="h-3 w-5/6 rounded bg-gradient-to-r from-[#eeeeea] via-[#f6f6f3] to-[#eeeeea] animate-pulse"></div>
      </div>

      <!-- Content (Streaming or Done) -->
      <template v-else>
        <!-- Context Meaning -->
        <div v-if="displayContextMeaning" class="rounded-lg bg-[#eef0fb] p-2.5 text-xs font-semibold text-[#232f9e]">
          {{ displayContextMeaning }}
        </div>

        <!-- Highlighted Sentence -->
        <div v-if="sentence" class="border-l-2 border-[#3b4cca] pl-2.5 text-xs text-[#5f5f5a] leading-relaxed">
          <span v-for="(seg, idx) in sentenceSegments" :key="idx" :class="{ 'font-bold text-[#1c1c1a] bg-[#f6e7b0] px-0.5 rounded': seg.highlight }">
            {{ seg.text }}
          </span>
        </div>

        <!-- Core Meanings -->
        <div v-if="displayCoreMeanings && displayCoreMeanings.length > 0" class="space-y-1">
          <div class="text-[10px] font-semibold tracking-wider text-[#97978f] uppercase">核心词义</div>
          <ul class="list-disc pl-4 text-xs text-[#1c1c1a] space-y-0.5">
            <li v-for="(m, i) in displayCoreMeanings" :key="i">{{ m }}</li>
          </ul>
        </div>

        <!-- Analysis -->
        <div v-if="displayAnalysis" class="space-y-1">
          <div class="text-[10px] font-semibold tracking-wider text-[#97978f] uppercase">简明语境解析</div>
          <p class="text-xs text-[#5f5f5a] bg-[#f7f7f5] p-2 rounded-lg leading-normal">
            {{ displayAnalysis }}
          </p>
        </div>
      </template>
    </div>

    <!-- Footer Buttons -->
    <div class="flex items-center gap-2 border-t border-[#f0f0ec] px-4 py-2.5 bg-[#fafaf8] rounded-b-2xl">
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-lg bg-[#3b4cca] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#2f3eaa] disabled:opacity-50 transition-colors"
        :disabled="state === 'loading' || state === 'error' || isSaved"
        @click="$emit('save')"
      >
        <span v-if="isSaved">✓ 已收藏</span>
        <span v-else-if="savedCount > 0">再次记录语境</span>
        <span v-else>加入生词本</span>
      </button>

      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-lg border border-[#e8e8e4] bg-white px-2.5 py-1.5 text-xs text-[#5f5f5a] hover:bg-[#f7f7f5] transition-colors ml-auto"
        title="复制词条"
        @click="copyEntry"
      >
        <span v-if="copied">已复制</span>
        <span v-else>复制</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { AiWordEntry } from '../shared/types';
import type { AppError } from '../shared/errors';

const props = withDefaults(
  defineProps<{
    state: 'hidden' | 'loading' | 'done' | 'error';
    word: string;
    sentence?: string;
    entry?: AiWordEntry | null;
    partial?: Partial<AiWordEntry> | null;
    savedCount?: number;
    isSaved?: boolean;
    error?: AppError | null;
    position?: { x: number; y: number };
  }>(),
  {
    sentence: '',
    entry: null,
    partial: null,
    savedCount: 0,
    isSaved: false,
    error: null,
    position: () => ({ x: 100, y: 100 }),
  }
);

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save'): void;
  (e: 'retry'): void;
  (e: 'openOptions'): void;
  (e: 'updatePosition', pos: { x: number; y: number }): void;
}>();

const copied = ref(false);

const displayWord = computed(() => {
  return props.entry?.word || props.partial?.word || props.word;
});

const displayPhonetic = computed(() => {
  return props.entry?.phonetic || props.partial?.phonetic || '';
});

const displayContextMeaning = computed(() => {
  return props.entry?.contextMeaning || props.partial?.contextMeaning || '';
});

const displayCoreMeanings = computed(() => {
  return props.entry?.coreMeanings || props.partial?.coreMeanings || [];
});

const displayAnalysis = computed(() => {
  return props.entry?.analysis || props.partial?.analysis || '';
});

// Segment sentence to highlight target word
const sentenceSegments = computed(() => {
  const sent = props.sentence || '';
  const target = props.word.trim();
  if (!sent || !target) return [{ text: sent, highlight: false }];

  const lowerSent = sent.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const idx = lowerSent.indexOf(lowerTarget);

  if (idx === -1) {
    return [{ text: sent, highlight: false }];
  }

  return [
    { text: sent.slice(0, idx), highlight: false },
    { text: sent.slice(idx, idx + target.length), highlight: true },
    { text: sent.slice(idx + target.length), highlight: false },
  ];
});

function copyEntry() {
  const content = `${displayWord.value} ${displayPhonetic.value}\n语境释义: ${displayContextMeaning.value}\n原句: ${props.sentence}`;
  navigator.clipboard.writeText(content).then(() => {
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1800);
  });
}

function startDrag(e: MouseEvent) {
  const startX = e.clientX - props.position.x;
  const startY = e.clientY - props.position.y;

  function onMouseMove(ev: MouseEvent) {
    const newX = Math.max(8, Math.min(window.innerWidth - 370, ev.clientX - startX));
    const newY = Math.max(8, Math.min(window.innerHeight - 200, ev.clientY - startY));
    emit('updatePosition', { x: newX, y: newY });
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
}
</script>
