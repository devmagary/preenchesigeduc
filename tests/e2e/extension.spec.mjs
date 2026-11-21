import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import * as XLSX from 'xlsx';
import { FICTIONAL_STUDENTS } from '../../trabalho/generate-fixtures.mjs';
import { startMockServer } from '../../trabalho/mock-server.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extE2eDir = path.join(rootDir, 'trabalho', 'dist-e2e');
const evidenciasDir = path.join(rootDir, 'trabalho', 'evidencias');

fs.mkdirSync(evidenciasDir, { recursive: true });

async function openPanel(page) {
  await page.waitForSelector('#preenche-sigeduc-host', { state: 'attached', timeout: 10000 });
  await page.evaluate(() => {
    const host = document.getElementById('preenche-sigeduc-host');
    host.shadowRoot.getElementById('ps-fab-btn').click();
  });
  await page.waitForFunction(() => {
    const host = document.getElementById('preenche-sigeduc-host');
    return host?.shadowRoot?.getElementById('ps-drawer')?.classList.contains('open');
  });
}

async function captureDownload(page, triggerFn, outPath) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    triggerFn(),
  ]);
  await download.saveAs(outPath);
}

async function runTests() {
  const srv = await startMockServer({ ajaxDelayMs: 25 });
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preenche-e2e-'));
  let context;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: chromePath,
      headless: false,
      ignoreDefaultArgs: ['--disable-extensions'],
      viewport: { width: 1280, height: 720 },
      acceptDownloads: true,
      args: [
        '--headless=new',
        '--enable-unsafe-extension-debugging',
        '--no-sandbox',
      ],
    });
    const bCdp = await context.browser().newBrowserCDPSession();
    await bCdp.send('Extensions.loadUnpacked', { path: extE2eDir });

    const page = await context.newPage();

    // 1. Scraping nas 4 telas + downloads (.xlsx, .csv, .json)
    console.log('[E2E] 1. Testando Scraping nas 4 telas...');
    await page.goto(`${srv.baseUrl}/sigeduc/portais/docente/docente.jsf`);
    await openPanel(page);
    await page.screenshot({ path: path.join(evidenciasDir, 'scraping_turmas_desktop.png') });

    await captureDownload(
      page,
      () => page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-exp-xlsx').click()),
      path.join(evidenciasDir, 'export_turmas.xlsx')
    );
    await captureDownload(
      page,
      () => page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-exp-csv').click()),
      path.join(evidenciasDir, 'export_turmas.csv')
    );
    await captureDownload(
      page,
      () => page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-exp-json').click()),
      path.join(evidenciasDir, 'export_turmas.json')
    );

    const turmasWb = XLSX.read(fs.readFileSync(path.join(evidenciasDir, 'export_turmas.xlsx')));
    assert.equal(turmasWb.SheetNames[0], 'Turmas');
    const turmasJson = JSON.parse(fs.readFileSync(path.join(evidenciasDir, 'export_turmas.json'), 'utf8'));
    assert.equal(turmasJson.turmas.length, 2);

    // Gerenciar Avaliações scraping
    await page.goto(`${srv.baseUrl}/sigeduc/ensino/grupo_avaliacao_unidade/lista.jsf`);
    await openPanel(page);
    await captureDownload(
      page,
      () => page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-exp-json').click()),
      path.join(evidenciasDir, 'export_avaliacoes.json')
    );
    const avJson = JSON.parse(fs.readFileSync(path.join(evidenciasDir, 'export_avaliacoes.json'), 'utf8'));
    assert.equal(avJson.avaliacoes.length, 7);

    // Notas Semestral scraping check
    await page.goto(`${srv.baseUrl}/sigeduc/diario_classe/lancar_notas/form_estudantes_notas_avaliacoes_unidade.jsf?tipo=semestral`);
    await openPanel(page);
    await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      sr.querySelector('[data-tab="extrair"]').click();
    });
    await captureDownload(
      page,
      () => page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-exp-xlsx').click()),
      path.join(evidenciasDir, 'modelo_notas_semestral.xlsx')
    );

    // 2. Preenchimento de Notas Anual (com casos de borda: divergentes, nota > máximo, conflito Rec. na U2, campos disabled na U1, e preenchimento completo na U3)
    console.log('[E2E] 2. Testando Preenchimento de Notas (45x4 + casos de borda)...');
    await page.goto(`${srv.baseUrl}/sigeduc/diario_classe/lancar_notas/form_estudantes_notas_avaliacoes_unidade.jsf`);
    await openPanel(page);

    const mixedRows = [
      ['Nome', 'Participação', 'Atividade Prática', 'Seminário', 'Avaliação Escrita'],
      ...FICTIONAL_STUDENTS.map((st, idx) => {
        if (idx === 0) return [st.nome, '2,0', '2,5', '1,8', '3,0'];
        if (idx === 1) return [st.nome, '2,5', '3,0', '2,0', '3,0']; // Participação 2.5 > max 2.0 (inválido!)
        return [st.nome, '1.8', '2.4', '1.6', '2.5'];
      }),
      ['ANA CLARA FERREIRO', '2,0', '3,0', '2,0', '3,0'], // divergente typo
      ['ALUNO FORA DA TURMA', '1,0', '1,0', '1,0', '1,0'],
    ];
    const mixedWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(mixedWb, XLSX.utils.aoa_to_sheet(mixedRows), 'Notas');
    const mixedXlsxPath = path.join(userDataDir, 'notas_mistas.xlsx');
    XLSX.writeFile(mixedWb, mixedXlsxPath);

    await page.locator('#preenche-sigeduc-host >> #ps-notas-file').setInputFiles(mixedXlsxPath);
    await page.waitForFunction(() => Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-run')));
    await page.screenshot({ path: path.join(evidenciasDir, 'notas_previa_desktop.png') });

    await fetch(`${srv.baseUrl}/__reset`);
    await page.evaluate(() => {
      document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-run').click();
    });
    await page.waitForFunction(() => Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-report')), null, { timeout: 60000 });
    await page.screenshot({ path: path.join(evidenciasDir, 'notas_relatorio_desktop.png') });

    await captureDownload(
      page,
      () => page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-dl-report').click()),
      path.join(evidenciasDir, 'relatorio_execucao_notas_completo.json')
    );

    const notasReport = JSON.parse(fs.readFileSync(path.join(evidenciasDir, 'relatorio_execucao_notas_completo.json'), 'utf8'));
    // 45 * 4 = 180 total slots, menos 1 inválido (idx 1 Participação 2.5 > 2.0) = 179 preenchidos!
    assert.equal(notasReport.filledCount, 179);
    assert.equal(notasReport.ajaxCompletedCount, 179);
    assert.equal(notasReport.invalidCount, 1);
    assert.equal(notasReport.invalidDetails.length, 1);
    assert.equal(notasReport.invalidDetails[0].studentName, 'BRUNO HENRIQUE SOUZA');
    assert.deepEqual(notasReport.notFoundInPage, ['ANA CLARA FERREIRO', 'ALUNO FORA DA TURMA']);

    const mAfterNotas = await (await fetch(`${srv.baseUrl}/__metrics`)).json();
    assert.equal(mAfterNotas.notasAjaxCount, 179);

    // Testar campos disabled na 1ª Unidade + conflito Rec. na 2ª Unidade (troca para aba 2ª Unidade)
    await page.evaluate(() => {
      document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-close-btn').click();
    });
    await page.click('a[href="#formulario:tab1j_id_1"]');
    await openPanel(page);
    await page.evaluate(() => {
      document.getElementById('preenche-sigeduc-host').shadowRoot.querySelector('[data-tab="notas"]').click();
    });
    const recRows = [['Nome', 'Participação'], ['ANA CLARA FERREIRA', '1.5'], ['BRUNO HENRIQUE SOUZA', '1.5']];
    const recWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(recWb, XLSX.utils.aoa_to_sheet(recRows), 'U2');
    const recPath = path.join(userDataDir, 'u2_disabled.xlsx');
    XLSX.writeFile(recWb, recPath);
    await page.locator('#preenche-sigeduc-host >> #ps-notas-file').setInputFiles(recPath);
    await page.waitForFunction(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      return sr?.textContent?.includes('(2 linhas)');
    });
    const u2Stats = await page.evaluate(() =>
      Array.from(document.getElementById('preenche-sigeduc-host').shadowRoot.querySelectorAll('.ps-stat strong')).map((e) => Number(e.textContent))
    );
    // 0 prontas, 2 bloqueadas (disabled)
    assert.equal(u2Stats[1], 0);
    assert.equal(u2Stats[3], 2);

    // 3. Frequência: colagem Ctrl+V liberada no Shadow DOM + data única + lote de 3 datas seguidas + auto-gravação com memória zerada
    console.log('[E2E] 3. Testando Frequência (Ctrl+V isolado, lote 3 datas, lógica invertida, RAM password)...');
    await page.goto(`${srv.baseUrl}/sigeduc/diario_classe/frequencia_aluno/form.jsf`);
    await openPanel(page);

    // Exportar modelo de frequência para evidência
    await page.evaluate(() => {
      document.getElementById('preenche-sigeduc-host').shadowRoot.querySelector('[data-tab="extrair"]').click();
    });
    await captureDownload(
      page,
      () => page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-exp-xlsx').click()),
      path.join(evidenciasDir, 'modelo_frequencia.xlsx')
    );

    // Voltar para aba Frequência e testar colagem Ctrl+V mesmo com bloqueio no document
    await page.evaluate(() => {
      document.getElementById('preenche-sigeduc-host').shadowRoot.querySelector('[data-tab="frequencia"]').click();
    });

    const pastedTsv = [
      'Nome\t05/08/2026\t12/08/2026\t19/08/2026\t25/08/2026\tObservação',
      'ANA CLARA FERREIRA\tF\t2\tP\tF\tFaltou por atestado',
      'BRUNO HENRIQUE SOUZA\tP\t1\tF\tP\t',
      'GABRIELA NASCIMENTO ROCHA\tF\tF\tP\tP\t',
    ].join('\n');

    await page.evaluate((txt) => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const ta = sr.getElementById('ps-freq-paste');
      ta.focus();
      const dt = new DataTransfer();
      dt.setData('text/plain', txt);
      const pasteEvent = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true });
      ta.dispatchEvent(pasteEvent);
      if (!ta.value) ta.value = txt;
    }, pastedTsv);

    const blockedCount = await page.evaluate(() => window.__sigeducPasteBlockedCount);
    assert.equal(blockedCount, 0, 'SIGEduc não deve interceptar paste dentro do Shadow DOM');

    await page.evaluate(() => {
      document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-freq-parse-paste').click();
    });
    await page.waitForFunction(() => Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-freq-run')));

    // Por padrão, apenas as 3 datas disponíveis no calendário vêm pré-selecionadas (25/08/2026 Indisponível fica desmarcada)
    const initialRunText = await page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-freq-run').textContent.trim());
    assert.equal(initialRunText, 'Preencher Frequência (3 data(s))');
    await page.screenshot({ path: path.join(evidenciasDir, 'frequencia_dia_unico_desktop.png') });

    // Marcar explicitamente 25/08/2026 para validar também o tratamento de data indisponível no lote
    await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const cb25 = sr.querySelector('.ps-freq-date-cb[value="25/08/2026"]');
      if (cb25 && !cb25.checked) {
        cb25.checked = true;
        cb25.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Ativar Auto-gravar lote na sessão para percorrer 05/08, 12/08 (2 slots!), 19/08 e 25/08 (indisponível)
    await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const cb = sr.getElementById('ps-freq-autosave');
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
      const pwd = sr.getElementById('ps-freq-pwd');
      pwd.value = 'SenhaTeste123';
      pwd.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await fetch(`${srv.baseUrl}/__reset`);
    await page.evaluate(() => {
      document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-freq-run').click();
    });

    await page.waitForFunction(() => Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-freq-report')), null, { timeout: 30000 });
    await page.screenshot({ path: path.join(evidenciasDir, 'frequencia_multiplas_datas_desktop.png') });

    await captureDownload(
      page,
      () => page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-freq-dl-report').click()),
      path.join(evidenciasDir, 'relatorio_execucao_frequencia.json')
    );

    const freqReport = JSON.parse(fs.readFileSync(path.join(evidenciasDir, 'relatorio_execucao_frequencia.json'), 'utf8'));
    assert.equal(freqReport.datesProcessed.length, 4);
    assert.equal(freqReport.datesProcessed[0].status, 'filled'); // 05/08
    assert.equal(freqReport.datesProcessed[1].status, 'filled'); // 12/08
    assert.equal(freqReport.datesProcessed[2].status, 'filled'); // 19/08
    assert.equal(freqReport.datesProcessed[3].status, 'date_unavailable'); // 25/08

    // Confirmar lógica invertida aplicada na última data carregada (19/08/2026: Bruno=F, Ana=P, Gabriela=P)
    const freqCheckboxes19 = await page.evaluate(() => ({
      anaSlot0: document.getElementById('formFrequencia:rows:0:slot0').checked,
      brunoSlot0: document.getElementById('formFrequencia:rows:1:slot0').checked,
      gabrielaSlot0: document.getElementById('formFrequencia:rows:6:slot0').checked,
      savedCount: window.__freqSaved || 0,
    }));
    assert.equal(freqCheckboxes19.anaSlot0, false);
    assert.equal(freqCheckboxes19.brunoSlot0, true);
    assert.equal(freqCheckboxes19.gabrielaSlot0, false);
    assert.equal(freqCheckboxes19.savedCount, 3);

    // Confirmar nenhuma senha persistida em storage
    const storageCheck = await page.evaluate(() => ({
      ls: JSON.stringify(window.localStorage),
      ss: JSON.stringify(window.sessionStorage),
    }));
    assert.equal(storageCheck.ls.includes('SenhaTeste123'), false);
    assert.equal(storageCheck.ss.includes('SenhaTeste123'), false);

    // 4. Mobile Android viewport (390x844) verificando responsividade e ausência de overflow horizontal
    console.log('[E2E] 4. Testando Viewport Mobile Android (390x844)...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${srv.baseUrl}/sigeduc/diario_classe/lancar_notas/form_estudantes_notas_avaliacoes_unidade.jsf`);
    await openPanel(page);
    await page.locator('#preenche-sigeduc-host >> #ps-notas-file').setInputFiles(mixedXlsxPath);
    await page.waitForFunction(() => Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-run')));

    const mobileLayout = await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const drawer = sr.getElementById('ps-drawer');
      const body = sr.getElementById('ps-body');
      const rect = drawer.getBoundingClientRect();
      return {
        drawerWidth: rect.width,
        viewportWidth: window.innerWidth,
        bodyOverflowX: body.scrollWidth > body.clientWidth + 1,
        hasOuterVScroll: window.innerWidth - document.documentElement.clientWidth > 0,
        hasOuterHScroll: window.innerHeight - document.documentElement.clientHeight > 0,
      };
    });
    assert.ok(mobileLayout.drawerWidth <= 391);
    assert.equal(mobileLayout.bodyOverflowX, false, 'Painel mobile não pode ter overflow horizontal');
    assert.equal(mobileLayout.hasOuterVScroll, false, 'Não deve haver barra vertical externa no mobile');
    assert.equal(mobileLayout.hasOuterHScroll, false, 'Não deve haver barra horizontal externa no mobile');
    await page.screenshot({ path: path.join(evidenciasDir, 'notas_previa_mobile.png') });

    await page.evaluate(() => {
      document.getElementById('preenche-sigeduc-host').shadowRoot.querySelector('[data-tab="extrair"]').click();
    });
    await page.screenshot({ path: path.join(evidenciasDir, 'scraping_notas_mobile.png') });

    await page.goto(`${srv.baseUrl}/sigeduc/diario_classe/frequencia_aluno/form.jsf`);
    await openPanel(page);
    await page.evaluate((txt) => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      sr.getElementById('ps-freq-paste').value = txt;
      sr.getElementById('ps-freq-parse-paste').click();
    }, pastedTsv);
    await page.waitForFunction(() => Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-freq-run')));
    await page.screenshot({ path: path.join(evidenciasDir, 'frequencia_mobile.png') });

    console.log('[E2E] Todos os cenários E2E passaram com sucesso!');
  } finally {
    if (context) await context.close();
    await srv.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // ignore transient Windows file lock on temp profile cleanup
    }
  }
}

await runTests();
