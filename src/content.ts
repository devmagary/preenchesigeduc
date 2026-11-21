import { PreenchePanelController } from './ui/panel';

function injectPageBridge(): void {
  const api = typeof chrome !== 'undefined' && chrome.runtime ? chrome : browser;
  if (!api?.runtime?.getURL) return;
  if (document.getElementById('preenche-sigeduc-bridge')) return;
  const s = document.createElement('script');
  s.id = 'preenche-sigeduc-bridge';
  s.src = api.runtime.getURL('page-bridge.js');
  (document.head || document.documentElement).appendChild(s);
}

function init(): void {
  if (document.getElementById('preenche-sigeduc-host')) return;
  injectPageBridge();
  const controller = new PreenchePanelController(document);

  const api = typeof chrome !== 'undefined' && chrome.runtime ? chrome : browser;
  api?.runtime?.onMessage?.addListener((msg: unknown, _sender: unknown, sendResponse: (res?: unknown) => void) => {
    const payload = msg as { type?: string } | null;
    if (!payload?.type) return false;

    if (payload.type === 'PREENCHE_GET_STATUS') {
      sendResponse({ ok: true, detection: controller.getDetection() });
      return true;
    }
    if (payload.type === 'PREENCHE_TOGGLE_PANEL') {
      const open = controller.toggle();
      sendResponse({ ok: true, open, detection: controller.getDetection() });
      return true;
    }
    return false;
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
