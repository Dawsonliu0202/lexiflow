import type { SelectionMode } from '../../shared/types';

export interface ValidSelection {
  valid: true;
  text: string;
  range: Range;
  rect: DOMRect; // Last line rect for floating ball positioning
  boundingRect: DOMRect; // Overall bounding rect for translation card positioning
  type: SelectionMode;
}

export interface InvalidSelection {
  valid: false;
  text?: string;
}

export type SelectionCheckResult = ValidSelection | InvalidSelection;

export function detectSelectionType(text: string): SelectionMode {
  const trimmed = text.trim();
  const clean = trimmed.replace(/^["'“‘(]+|[)"'”’,.!?]+$/g, '');
  const tokens = clean.split(/\s+/).filter(Boolean);

  // Single word: exactly 1 token and length < 45 chars
  if (tokens.length === 1 && clean.length < 45) {
    return 'word';
  }

  // Phrase: 2-8 tokens without sentence-ending punctuation or newlines
  if (tokens.length <= 8 && !/[.?!;:\n\r。？！；：]/.test(clean) && clean.length < 120) {
    return 'phrase';
  }

  // Sentence or passage/paragraph
  return 'sentence';
}

export function isEditableElement(node: Node | null): boolean {
  if (!node) return false;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
  if (!el) return false;
  return !!el.closest('input, textarea, [contenteditable="true"], [contenteditable=""]');
}

export function checkSelection(
  selection: Selection | null,
  isSiteDisabled: boolean,
  shadowHost?: HTMLElement | null
): SelectionCheckResult {
  if (isSiteDisabled || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return { valid: false };
  }

  const text = selection.toString().trim();

  // 1. Empty or whitespace only
  if (!text) {
    return { valid: false };
  }

  // 2. Length > 5000 chars (protect against full-page accidental selection)
  if (text.length > 5000) {
    return { valid: false, text };
  }

  // 3. Must contain at least one letter or CJK character
  if (!/[A-Za-z\u4e00-\u9fa5]/.test(text)) {
    return { valid: false, text };
  }

  const range = selection.getRangeAt(0);

  // 4. Must not be inside editable element
  if (isEditableElement(range.startContainer) || isEditableElement(range.endContainer)) {
    return { valid: false, text };
  }

  // 5. Must not be inside the extension's own UI
  if (shadowHost) {
    if (
      shadowHost === range.startContainer ||
      shadowHost === range.endContainer ||
      shadowHost.contains(range.startContainer) ||
      shadowHost.contains(range.endContainer)
    ) {
      return { valid: false, text };
    }
  }

  const boundingRect = range.getBoundingClientRect();
  const rects = range.getClientRects();

  if (boundingRect.width === 0 && boundingRect.height === 0 && rects.length === 0) {
    return { valid: false, text };
  }

  const lastRect = rects.length > 0 ? rects[rects.length - 1] : boundingRect;
  const type = detectSelectionType(text);

  return {
    valid: true,
    text,
    range: range.cloneRange(),
    rect: lastRect,
    boundingRect,
    type,
  };
}
