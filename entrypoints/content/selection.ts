export interface ValidSelection {
  valid: true;
  text: string;
  range: Range;
  rect: DOMRect;
}

export interface InvalidSelection {
  valid: false;
  text?: string;
}

export type SelectionCheckResult = ValidSelection | InvalidSelection;

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

  // 2. Length > 200 chars (paragraph, not a word/phrase)
  if (text.length > 200) {
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

  let rect = range.getBoundingClientRect();
  // If bounding rect is 0, try getClientRects
  if (rect.width === 0 && rect.height === 0) {
    const rects = range.getClientRects();
    if (rects.length > 0) {
      rect = rects[rects.length - 1];
    } else {
      return { valid: false, text };
    }
  }

  return {
    valid: true,
    text,
    range: range.cloneRange(),
    rect,
  };
}
