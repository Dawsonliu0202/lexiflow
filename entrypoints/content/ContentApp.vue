<template>
  <div class="lexi-root pointer-events-none fixed inset-0 z-[2147483647]">
    <!-- Floating translate trigger icon -->
    <button
      v-if="isIconVisible"
      type="button"
      class="pointer-events-auto fixed flex h-7 w-7 items-center justify-center rounded-full bg-[#3b4cca] text-white shadow-[0_2px_10px_rgba(20,20,60,0.3)] border-2 border-white hover:scale-110 hover:bg-[#2f3eaa] transition-transform select-none cursor-pointer"
      :style="{ left: `${iconPos.x}px`, top: `${iconPos.y}px` }"
      title="LexiFlow 语境翻译"
      @mousedown.stop
      @click.stop="onIconClick"
    >
      <svg
        class="h-3.5 w-3.5 pointer-events-none"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="m5 8 6 6" />
        <path d="m4 14 6-6 2-3" />
        <path d="M2 5h12" />
        <path d="M7 2h1" />
        <path d="m22 22-5-10-5 10" />
        <path d="M14 18h6" />
      </svg>
    </button>

    <!-- Translate Card -->
    <div class="pointer-events-auto">
      <TranslateCard
        v-if="cardState.visible"
        :state="cardState.state"
        :word="cardState.word"
        :sentence="cardState.sentence"
        :entry="cardState.entry"
        :partial="cardState.partial"
        :saved-count="cardState.savedCount"
        :is-saved="cardState.isSaved"
        :error="cardState.error"
        :position="cardState.position"
        @close="onClose"
        @save="onSave"
        @retry="onRetry"
        @open-options="onOpenOptions"
        @update-position="onUpdatePosition"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { AiWordEntry } from '../../shared/types';
import type { AppError } from '../../shared/errors';
import { partialParse } from '../../services/ai/parse';
import { requestRpc } from '../../messaging/client';
import { ContentTranslateClient } from './port';
import TranslateCard from '../../components/TranslateCard.vue';

export interface FloatingCardState {
  visible: boolean;
  state: 'hidden' | 'loading' | 'done' | 'error';
  word: string;
  sentence: string;
  pageTitle: string;
  pageUrl: string;
  entry: AiWordEntry | null;
  partial: Partial<AiWordEntry> | null;
  savedCount: number;
  isSaved: boolean;
  error: AppError | null;
  position: { x: number; y: number };
}

const isIconVisible = ref(false);
const iconPos = ref({ x: 0, y: 0 });

const cardState = ref<FloatingCardState>({
  visible: false,
  state: 'hidden',
  word: '',
  sentence: '',
  pageTitle: '',
  pageUrl: '',
  entry: null,
  partial: null,
  savedCount: 0,
  isSaved: false,
  error: null,
  position: { x: 0, y: 0 },
});

const translateClient = new ContentTranslateClient();

function onIconClick() {
  isIconVisible.value = false;
  startTranslation();
}

function onClose() {
  cardState.value.visible = false;
  translateClient.abort();
}

async function onSave() {
  const entry = cardState.value.entry || cardState.value.partial;
  if (!entry || !entry.lemma || !entry.contextMeaning) return;

  try {
    const res = await requestRpc('SAVE_WORD', {
      entry: {
        word: entry.word || cardState.value.word,
        lemma: entry.lemma,
        phonetic: entry.phonetic || '',
        contextMeaning: entry.contextMeaning,
        coreMeanings: entry.coreMeanings || [],
        analysis: entry.analysis || '',
      },
      context: {
        sentence: cardState.value.sentence,
        pageTitle: cardState.value.pageTitle,
        pageUrl: cardState.value.pageUrl,
      },
    });
    cardState.value.savedCount = res.count;
    cardState.value.isSaved = true;
  } catch (err) {
    console.error('Failed to save word:', err);
  }
}

function onRetry() {
  startTranslation();
}

function onOpenOptions() {
  if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  }
}

function onUpdatePosition(pos: { x: number; y: number }) {
  cardState.value.position = pos;
}

function startTranslation() {
  cardState.value.visible = true;
  cardState.value.state = 'loading';
  cardState.value.entry = null;
  cardState.value.partial = null;
  cardState.value.error = null;
  cardState.value.isSaved = false;

  // Check existing count in DB
  requestRpc('GET_WORD_STATE', { lemma: cardState.value.word.toLowerCase() })
    .then((res) => {
      if (res.exists) {
        cardState.value.savedCount = res.count;
      }
    })
    .catch(() => {});

  translateClient.start(
    {
      word: cardState.value.word,
      sentence: cardState.value.sentence,
      pageTitle: cardState.value.pageTitle,
      pageUrl: cardState.value.pageUrl,
    },
    {
      onChunk(text) {
        cardState.value.partial = partialParse(text);
      },
      onDone(entry) {
        cardState.value.state = 'done';
        cardState.value.entry = entry;
      },
      onError(error) {
        cardState.value.state = 'error';
        cardState.value.error = error;
      },
    }
  );
}

function showIcon(pos: { x: number; y: number }, word: string, sentence: string) {
  iconPos.value = pos;
  isIconVisible.value = true;

  // Position card near icon by default
  const cardWidth = 356;
  const cardHeight = 340;
  const margin = 12;

  let cardX = pos.x;
  let cardY = pos.y + 36;

  if (cardX + cardWidth > window.innerWidth - margin) {
    cardX = Math.max(margin, window.innerWidth - cardWidth - margin);
  }
  if (cardX < margin) cardX = margin;

  if (cardY + cardHeight > window.innerHeight - margin) {
    cardY = Math.max(margin, pos.y - cardHeight - 8);
  }
  if (cardY < margin) cardY = margin;

  cardState.value.word = word;
  cardState.value.sentence = sentence;
  cardState.value.pageTitle = document.title || '';
  cardState.value.pageUrl = window.location.href.split('#')[0];
  cardState.value.position = { x: cardX, y: cardY };
}

function hideIcon() {
  isIconVisible.value = false;
}

function hideAll() {
  isIconVisible.value = false;
  cardState.value.visible = false;
  translateClient.abort();
}

defineExpose({
  showIcon,
  hideIcon,
  hideAll,
});
</script>
