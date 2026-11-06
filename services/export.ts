import type { Word } from '../shared/types';
import { escapeCsvField } from '../shared/utils';

export interface ExportData {
  schemaVersion: number;
  exportedAt: string;
  count: number;
  words: Word[];
}

export function exportWordsToJson(words: Word[]): string {
  const data: ExportData = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    count: words.length,
    words,
  };
  return JSON.stringify(data, null, 2);
}

export function exportWordsToCsv(words: Word[]): string {
  const headers = [
    'lemma',
    'word',
    'phonetic',
    'contextMeaning',
    'coreMeanings',
    'analysis',
    'count',
    'firstSeenAt',
    'lastSeenAt',
    'contexts',
  ];

  const rows: string[] = [headers.join(',')];

  for (const w of words) {
    const coreMeaningsStr = (w.coreMeanings || []).join('；');
    const firstSeenStr = w.firstSeenAt ? new Date(w.firstSeenAt).toISOString() : '';
    const lastSeenStr = w.updatedAt ? new Date(w.updatedAt).toISOString() : '';

    const contextsStr = (w.contexts || [])
      .map((c) => `${c.sentence} | ${c.pageTitle} | ${c.pageUrl}`)
      .join('\n');

    const row = [
      escapeCsvField(w.lemma),
      escapeCsvField(w.word),
      escapeCsvField(w.phonetic),
      escapeCsvField(w.contextMeaning),
      escapeCsvField(coreMeaningsStr),
      escapeCsvField(w.analysis),
      escapeCsvField(w.count),
      escapeCsvField(firstSeenStr),
      escapeCsvField(lastSeenStr),
      escapeCsvField(contextsStr),
    ];

    rows.push(row.join(','));
  }

  // Prepend UTF-8 BOM so Microsoft Excel interprets encoding as UTF-8 properly
  return '\uFEFF' + rows.join('\r\n');
}

export function getExportFilename(extension: 'json' | 'csv'): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `lexiflow-${yyyy}${mm}${dd}-${hh}${min}.${extension}`;
}

export function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
