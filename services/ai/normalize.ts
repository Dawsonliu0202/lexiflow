export function normalizeBaseUrl(url: string): string {
  let cleaned = url.trim();
  // Remove trailing slashes
  cleaned = cleaned.replace(/\/+$/, '');
  // If user pasted full endpoint e.g. /chat/completions or /v1/chat/completions, strip it
  cleaned = cleaned.replace(/\/chat\/completions$/, '');
  return cleaned;
}

export function normalizeLemma(lemma: string): string {
  return lemma.trim().toLowerCase();
}
