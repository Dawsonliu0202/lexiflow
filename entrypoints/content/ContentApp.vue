<template>
  <div class="lexi-root pointer-events-none fixed inset-0 z-[2147483647]">
    <!-- Floating translate trigger icon (32px x 32px) -->
    <button
      v-if="isIconVisible"
      type="button"
      class="pointer-events-auto fixed flex h-8 w-8 items-center justify-center rounded-full bg-[#3b4cca] text-white shadow-[0_2px_12px_rgba(20,20,60,0.35)] border-2 border-white hover:scale-110 hover:bg-[#2f3eaa] transition-transform select-none cursor-pointer"
      :style="{ left: `${iconPos.x}px`, top: `${iconPos.y}px` }"
      title="LexiFlow 语境翻译"
      @mousedown.stop
      @mouseup.stop
      @click.stop="onIconClick"
    >
      <svg
        class="h-4 w-4 pointer-events-none"
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
        :mode="cardState.mode"
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
import { ref, onMounted, onUnmounted } from 'vue';
import type { AiWordEntry, SelectionMode } from '../../shared/types';
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
  mode: SelectionMode;
  entry: AiWordEntry | null;
  partial: Partial<AiWordEntry> | null;
  savedCount: number;
  isSaved: boolean;
  error: AppError | null;
  position: { x: number; y: number };
}

const isIconVisible = ref(false);
const iconPos = ref({ x: 0, y: 0 });

let currentAnchorRange: Range | null = null;
let anchorOffset = { x: 0, y: 0 };
let scrollRafId: number | null = null;

const cardState = ref<FloatingCardState>({
  visible: false,
  state: 'hidden',
  word: '',
  sentence: '',
  pageTitle: '',
  pageUrl: '',
  mode: 'word',
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
  if (currentAnchorRange && currentAnchorRange.startContainer?.isConnected) {
    const latestRect = currentAnchorRange.getBoundingClientRect();
    if (latestRect.width > 0 || latestRect.height > 0) {
      const cardWidth = cardState.value.mode === 'word' ? 380 : 440;
      const cardHeight = cardState.value.mode === 'word' ? 380 : 420;
      const margin = 12;

      let cardX = latestRect.left;
      if (cardX + cardWidth > window.innerWidth - margin) {
        cardX = Math.max(margin, window.innerWidth - cardWidth - margin);
      }
      if (cardX < margin) cardX = margin;

      const spaceBelow = window.innerHeight - latestRect.bottom;
      const spaceAbove = latestRect.top;

      let cardY: number;
      if (spaceBelow >= 260 || spaceBelow >= spaceAbove) {
        cardY = latestRect.bottom + 8;
        if (cardY + cardHeight > window.innerHeight - margin) {
          cardY = Math.max(margin, window.innerHeight - cardHeight - margin);
        }
      } else {
        cardY = Math.max(margin, latestRect.top - cardHeight - 8);
      }

      cardState.value.position = { x: cardX, y: cardY };
      anchorOffset = {
        x: cardX - latestRect.left,
        y: cardY - latestRect.top,
      };
    }
  }
  startTranslation();
}

function onClose() {
  cardState.value.visible = false;
  cardState.value.savedCount = 0;
  cardState.value.isSaved = false;
  currentAnchorRange = null;
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId);
    scrollRafId = null;
  }
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
  if (currentAnchorRange && currentAnchorRange.startContainer?.isConnected) {
    const baseRect = currentAnchorRange.getBoundingClientRect();
    if (baseRect.width > 0 || baseRect.height > 0) {
      anchorOffset = {
        x: pos.x - baseRect.left,
        y: pos.y - baseRect.top,
      };
    }
  }
}

function handleScrollOrResize() {
  if (scrollRafId !== null) return;
  scrollRafId = requestAnimationFrame(() => {
    scrollRafId = null;

    if (!currentAnchorRange || !currentAnchorRange.startContainer?.isConnected) {
      return;
    }

    // 1. Follow selection when card is visible
    if (cardState.value.visible) {
      const baseRect = currentAnchorRange.getBoundingClientRect();
      if (baseRect.width > 0 || baseRect.height > 0) {
        cardState.value.position = {
          x: baseRect.left + anchorOffset.x,
          y: baseRect.top + anchorOffset.y,
        };
      }
    }

    // 2. Follow selection when floating ball is visible
    if (isIconVisible.value && !cardState.value.visible) {
      const rects = currentAnchorRange.getClientRects();
      const lastRect = rects.length > 0 ? rects[rects.length - 1] : currentAnchorRange.getBoundingClientRect();
      if (lastRect && (lastRect.width > 0 || lastRect.height > 0)) {
        if (lastRect.bottom < 0 || lastRect.top > window.innerHeight) {
          isIconVisible.value = false;
        } else {
          const margin = 8;
          const iconSize = 32;
          let iconX = lastRect.right + 6;
          let iconY = lastRect.bottom + 2;
          if (iconX + iconSize > window.innerWidth - margin) {
            iconX = Math.max(margin, lastRect.right - iconSize - 4);
          }
          if (iconX < margin) iconX = margin;
          if (iconY + iconSize > window.innerHeight - margin) {
            iconY = Math.max(margin, lastRect.top - iconSize - 4);
          }
          if (iconY < margin) iconY = margin;
          iconPos.value = { x: iconX, y: iconY };
        }
      }
    }
  });
}

function startTranslation() {
  cardState.value.visible = true;
  cardState.value.state = 'loading';
  cardState.value.entry = null;
  cardState.value.partial = null;
  cardState.value.error = null;
  cardState.value.savedCount = 0;
  cardState.value.isSaved = false;

  // Check existing count in DB only for word mode
  if (cardState.value.mode === 'word') {
    const checkTarget = cardState.value.word.trim().toLowerCase();
    requestRpc('GET_WORD_STATE', { lemma: checkTarget })
      .then((res) => {
        cardState.value.savedCount = res.exists ? res.count : 0;
      })
      .catch(() => {
        cardState.value.savedCount = 0;
      });
  }

  translateClient.start(
    {
      word: cardState.value.word,
      sentence: cardState.value.sentence,
      pageTitle: cardState.value.pageTitle,
      pageUrl: cardState.value.pageUrl,
      mode: cardState.value.mode,
    },
    {
      onChunk(text) {
        cardState.value.partial = partialParse(text);
      },
      onDone(entry) {
        cardState.value.state = 'done';
        cardState.value.entry = entry;
        if (cardState.value.mode === 'word') {
          const targetLemma = (entry.lemma || cardState.value.word).trim().toLowerCase();
          requestRpc('GET_WORD_STATE', { lemma: targetLemma })
            .then((res) => {
              cardState.value.savedCount = res.exists ? res.count : 0;
            })
            .catch(() => {
              cardState.value.savedCount = 0;
            });
        }
      },
      onError(error) {
        cardState.value.state = 'error';
        cardState.value.error = error;
      },
    }
  );
}

function showIcon(
  pos: { x: number; y: number },
  word: string,
  sentence: string,
  mode: SelectionMode = 'word',
  boundingRect?: DOMRect,
  range?: Range
) {
  iconPos.value = pos;
  isIconVisible.value = true;
  currentAnchorRange = range ? range.cloneRange() : null;

  // Reset saved state for the new selection
  cardState.value.savedCount = 0;
  cardState.value.isSaved = false;

  // Calculate card width and height depending on mode
  const cardWidth = mode === 'word' ? 380 : 440;
  const cardHeight = mode === 'word' ? 380 : 420;
  const margin = 12;

  const targetRect = boundingRect || {
    left: pos.x,
    right: pos.x,
    top: pos.y,
    bottom: pos.y,
    width: 0,
    height: 0,
  };

  // Horizontal position: follow selection left boundary
  let cardX = targetRect.left;
  if (cardX + cardWidth > window.innerWidth - margin) {
    cardX = Math.max(margin, window.innerWidth - cardWidth - margin);
  }
  if (cardX < margin) cardX = margin;

  // Vertical position: follow selection below or above
  const spaceBelow = window.innerHeight - targetRect.bottom;
  const spaceAbove = targetRect.top;

  let cardY: number;
  if (spaceBelow >= 260 || spaceBelow >= spaceAbove) {
    cardY = targetRect.bottom + 8;
    if (cardY + cardHeight > window.innerHeight - margin) {
      cardY = Math.max(margin, window.innerHeight - cardHeight - margin);
    }
  } else {
    cardY = Math.max(margin, targetRect.top - cardHeight - 8);
  }

  cardState.value.mode = mode;
  cardState.value.word = word;
  cardState.value.sentence = sentence;
  cardState.value.pageTitle = document.title || '';
  cardState.value.pageUrl = window.location.href.split('#')[0];
  cardState.value.position = { x: cardX, y: cardY };

  if (currentAnchorRange && currentAnchorRange.startContainer?.isConnected) {
    const baseRect = currentAnchorRange.getBoundingClientRect();
    if (baseRect.width > 0 || baseRect.height > 0) {
      anchorOffset = {
        x: cardX - baseRect.left,
        y: cardY - baseRect.top,
      };
    }
  }
}

function hideIcon() {
  isIconVisible.value = false;
}

function hideAll() {
  isIconVisible.value = false;
  cardState.value.visible = false;
  cardState.value.savedCount = 0;
  cardState.value.isSaved = false;
  currentAnchorRange = null;
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId);
    scrollRafId = null;
  }
  translateClient.abort();
}

function isCardVisible(): boolean {
  return cardState.value.visible;
}

onMounted(() => {
  window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
  window.addEventListener('resize', handleScrollOrResize, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
  window.removeEventListener('resize', handleScrollOrResize);
  if (scrollRafId !== null) {
    cancelAnimationFrame(scrollRafId);
    scrollRafId = null;
  }
});

defineExpose({
  showIcon,
  hideIcon,
  hideAll,
  isCardVisible,
});
</script>
