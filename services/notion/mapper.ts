import type { Word, WordContext } from '../../shared/types';

const MAX_RICH_TEXT_LEN = 2000;

function truncateText(str: string, maxLen = MAX_RICH_TEXT_LEN): string {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

export function toDatabaseProperties(
  word: Word,
  mode: 'create' | 'update',
  targetCount?: number
): Record<string, unknown> {
  const latestCtx = word.contexts[0];
  const count = targetCount !== undefined ? targetCount : word.count;

  const props: Record<string, unknown> = {
    Word: {
      rich_text: [{ type: 'text', text: { content: truncateText(word.word) } }],
    },
    Meaning: {
      rich_text: [{ type: 'text', text: { content: truncateText(word.contextMeaning) } }],
    },
    Count: {
      number: count,
    },
    'Last Seen': {
      date: { start: new Date(word.updatedAt).toISOString() },
    },
  };

  if (latestCtx) {
    if (latestCtx.sentence) {
      props['Latest Context'] = {
        rich_text: [{ type: 'text', text: { content: truncateText(latestCtx.sentence) } }],
      };
    }
    if (latestCtx.pageUrl && latestCtx.pageUrl.length <= MAX_RICH_TEXT_LEN) {
      props['Source'] = {
        url: latestCtx.pageUrl,
      };
    }
    if (latestCtx.pageTitle) {
      props['Source Title'] = {
        rich_text: [{ type: 'text', text: { content: truncateText(latestCtx.pageTitle) } }],
      };
    }
  }

  if (mode === 'create') {
    props['Lemma'] = {
      title: [{ type: 'text', text: { content: truncateText(word.lemma) } }],
    };
    if (word.phonetic) {
      props['Phonetic'] = {
        rich_text: [{ type: 'text', text: { content: truncateText(word.phonetic) } }],
      };
    }
    if (word.coreMeanings && word.coreMeanings.length > 0) {
      props['Core Meanings'] = {
        rich_text: [
          { type: 'text', text: { content: truncateText(word.coreMeanings.join('；')) } },
        ],
      };
    }
    if (word.analysis) {
      props['Analysis'] = {
        rich_text: [{ type: 'text', text: { content: truncateText(word.analysis) } }],
      };
    }
    props['First Seen'] = {
      date: { start: new Date(word.firstSeenAt).toISOString() },
    };
    props['Status'] = {
      select: { name: 'New' },
    };
  }

  return props;
}

export function toContextBulletBlock(ctx: WordContext): Record<string, unknown> {
  const sentence = truncateText(ctx.sentence, 1500);
  const title = truncateText(ctx.pageTitle || '来源链接', 200);
  const dateStr = new Date(ctx.capturedAt).toLocaleDateString('zh-CN');

  const richTextElements: Array<Record<string, unknown>> = [
    {
      type: 'text',
      text: { content: `“${sentence}” — ` },
    },
  ];

  if (ctx.pageUrl && (ctx.pageUrl.startsWith('http://') || ctx.pageUrl.startsWith('https://'))) {
    richTextElements.push({
      type: 'text',
      text: {
        content: title,
        link: { url: ctx.pageUrl },
      },
    });
  } else {
    richTextElements.push({
      type: 'text',
      text: { content: title },
    });
  }

  richTextElements.push({
    type: 'text',
    text: { content: ` · ${dateStr}` },
  });

  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: richTextElements,
    },
  };
}

export function toContextBlocks(contexts: WordContext[]): Array<Record<string, unknown>> {
  return contexts.map((ctx) => toContextBulletBlock(ctx));
}

export function chunkBlocks(
  blocks: Array<Record<string, unknown>>,
  chunkSize = 100
): Array<Array<Record<string, unknown>>> {
  const chunks: Array<Array<Record<string, unknown>>> = [];
  for (let i = 0; i < blocks.length; i += chunkSize) {
    chunks.push(blocks.slice(i, i + chunkSize));
  }
  return chunks;
}
