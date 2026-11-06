import { defineContentScript } from 'wxt/sandbox';
import './style.css';
import { checkSelection } from './selection';
import { extractSentenceFromRange } from './sentence';
import { createContentUi } from './ui';
import { requestRpc } from '../../messaging/client';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    let isSiteDisabled = false;
    const currentHost = window.location.hostname;

    // Check whether current site is disabled
    try {
      const res = await requestRpc('GET_SITE_DISABLED', { host: currentHost });
      isSiteDisabled = !!res.disabled;
    } catch {
      // Default to enabled if query fails
    }

    const contentUi = await createContentUi(ctx);
    contentUi.ui.mount();

    // Clean up when extension is reloaded or context invalidated
    ctx.onInvalidated(() => {
      contentUi.hideAll();
      contentUi.ui.remove();
    });

    // Handle site toggle notification from Popup
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg?.type === 'SITE_TOGGLED' && msg?.host === currentHost) {
          isSiteDisabled = !!msg.disabled;
          if (isSiteDisabled) {
            contentUi.hideAll();
          }
        }
      });
    }

    let selectionTimeout: number | undefined;

    function handleSelectionChange() {
      if (selectionTimeout) {
        window.clearTimeout(selectionTimeout);
      }

      selectionTimeout = window.setTimeout(() => {
        if (isSiteDisabled) {
          contentUi.hideIcon();
          return;
        }

        const sel = window.getSelection();
        const check = checkSelection(sel, isSiteDisabled, contentUi.getShadowHost());

        if (!check.valid || !check.range || !check.rect || !check.boundingRect) {
          contentUi.hideIcon();
          return;
        }

        const sentence = check.type === 'sentence' ? check.text : extractSentenceFromRange(check.range);
        const lastRect = check.rect;
        const boundingRect = check.boundingRect;

        const margin = 8;
        const iconSize = 32;

        // Position icon at the end of user selection (last line rect right edge)
        let iconX = lastRect.right + 6;
        let iconY = lastRect.bottom + 2;

        // Clamp to viewport boundary or flip if overflowing
        if (iconX + iconSize > window.innerWidth - margin) {
          iconX = Math.max(margin, lastRect.right - iconSize - 4);
        }
        if (iconX < margin) iconX = margin;

        if (iconY + iconSize > window.innerHeight - margin) {
          iconY = Math.max(margin, lastRect.top - iconSize - 4);
        }
        if (iconY < margin) iconY = margin;

        contentUi.showIcon(
          { x: iconX, y: iconY },
          check.text,
          sentence,
          check.type,
          boundingRect,
          check.range
        );
      }, 60);
    }

    document.addEventListener('mouseup', (e) => {
      const host = contentUi.getShadowHost();
      if (host) {
        if (e.target === host || host.contains(e.target as Node)) return;
        if (typeof e.composedPath === 'function' && e.composedPath().includes(host)) return;
      }
      handleSelectionChange();
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Shift' || e.key.startsWith('Arrow')) {
        handleSelectionChange();
      }
    });

    document.addEventListener('mousedown', (e) => {
      const host = contentUi.getShadowHost();
      if (host) {
        if (e.target === host || host.contains(e.target as Node)) return;
        if (typeof e.composedPath === 'function' && e.composedPath().includes(host)) return;
      }
      // Clicked outside on the web page: automatically close both floating ball and card popup
      contentUi.hideAll();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        contentUi.hideAll();
      }
    });
  },
});
