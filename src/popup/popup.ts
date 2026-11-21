const api = typeof chrome !== 'undefined' && chrome.tabs ? chrome : browser;

async function initPopup() {
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
