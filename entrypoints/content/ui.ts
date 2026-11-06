import { createApp, type App } from 'vue';
import type { ContentScriptContext } from 'wxt/client';
import { createShadowRootUi } from 'wxt/client';
import ContentApp from './ContentApp.vue';
import type { SelectionMode } from '../../shared/types';

export async function createContentUi(ctx: ContentScriptContext) {
  let appInstance: InstanceType<typeof ContentApp> | null = null;
  let vueApp: App | null = null;

  const ui = await createShadowRootUi(ctx, {
    name: 'lexiflow-shadow-root',
    position: 'inline',
    anchor: 'body',
    append: 'last',
    onMount(uiContainer) {
      vueApp = createApp(ContentApp);
      appInstance = vueApp.mount(uiContainer) as InstanceType<typeof ContentApp>;
    },
    onRemove() {
      if (vueApp) {
        vueApp.unmount();
        vueApp = null;
        appInstance = null;
      }
    },
  });

  return {
    ui,
    showIcon(
      pos: { x: number; y: number },
      word: string,
      sentence: string,
      mode: SelectionMode = 'word',
      boundingRect?: DOMRect,
      range?: Range
    ) {
      appInstance?.showIcon(pos, word, sentence, mode, boundingRect, range);
    },
    hideIcon() {
      appInstance?.hideIcon();
    },
    hideAll() {
      appInstance?.hideAll();
    },
    isCardVisible: () => appInstance?.isCardVisible() ?? false,
    getShadowHost: () => ui.shadowHost,
  };
}
