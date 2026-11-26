import {
  ABOUT_SECTIONS,
  APP_PORTAL_URL,
  APP_REPO_URL,
  getExtensionVersion,
} from '../core/about';

const api = typeof chrome !== 'undefined' && chrome.tabs ? chrome : browser;

function renderPopupAbout(): void {
  const verEl = document.getElementById('popup-version');
  if (verEl) {
    verEl.textContent = `v${getExtensionVersion('1.0.0')}`;
  }

  const contentEl = document.getElementById('popup-about-content');
  if (!contentEl) return;

  contentEl.innerHTML = '';
  for (const item of ABOUT_SECTIONS) {
    const block = document.createElement('div');
    block.className = 'about-item';
    const strong = document.createElement('strong');
    strong.textContent = item.title;
    const p = document.createElement('p');
    p.textContent = item.body;
    block.append(strong, p);
    contentEl.appendChild(block);
  }

  const linksWrap = document.createElement('div');
  linksWrap.className = 'about-links';
  const links: Array<{ label: string; url: string }> = [
    { label: 'Repositório GitHub', url: APP_REPO_URL },
    { label: 'Portal de Downloads', url: APP_PORTAL_URL },
  ];

  for (const linkInfo of links) {
    const a = document.createElement('a');
    a.className = 'about-link';
    a.href = linkInfo.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = linkInfo.label;
    a.addEventListener('click', (ev) => {
      if (api?.tabs?.create) {
        ev.preventDefault();
        void api.tabs.create({ url: linkInfo.url });
      }
    });
    linksWrap.appendChild(a);
  }
  contentEl.appendChild(linksWrap);
}

async function initPopup() {
  renderPopupAbout();
  const statusBox = document.getElementById('status-box');
  const btnToggle = document.getElementById('btn-toggle') as HTMLButtonElement | null;
  const btnOpen = document.getElementById('btn-open-sigeduc') as HTMLButtonElement | null;

  btnOpen?.addEventListener('click', () => {
    api?.tabs?.create({ url: 'https://sigeduc.educacao.ba.gov.br/sigeduc/verTelaLogin.do' });
  });

  if (!api?.tabs) return;

  try {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    const tab = tabs[0];
    const tabId = tab?.id;
    const url = tab?.url ?? '';

    const isSigeduc =
      url.includes('sigeduc.educacao.ba.gov.br/sigeduc') || url.startsWith('http://127.0.0.1');

    if (!tabId || !isSigeduc) {
      if (statusBox) {
        statusBox.textContent = 'Abra uma aba do SIGEduc-BA para usar o preenchimento e a extração.';
      }
      return;
    }

    const resp = (await api.tabs.sendMessage(tabId, { type: 'PREENCHE_GET_STATUS' })) as {
      ok?: boolean;
      detection?: { label: string; badge: string };
    };

    if (resp?.ok && resp.detection) {
      if (statusBox) {
        statusBox.innerHTML = `<strong>Conectado ao SIGEduc</strong><br/>Tela: ${resp.detection.label}`;
      }
      if (btnToggle) {
        btnToggle.disabled = false;
        btnToggle.addEventListener('click', async () => {
          await api.tabs.sendMessage(tabId, { type: 'PREENCHE_TOGGLE_PANEL' });
          window.close();
        });
      }
    }
  } catch {
    if (statusBox) {
      statusBox.textContent = 'Recarregue a página do SIGEduc para ativar a extensão.';
    }
  }
}

void initPopup();
