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

    // 1B. P2.4: Exportação Modelo Consolidado Padrão CETEP em turma individual (Semestral)
    console.log('[E2E] 1B. Testando Exportação CETEP em turma individual (Semestral)...');
    const cetepSinglePath = path.join(userDataDir, 'cetep_semestral.xlsx');
    await captureDownload(
      page,
      () => page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-cetep-dl-single').click()),
      cetepSinglePath
    );
    const cetepSingleWb = XLSX.read(fs.readFileSync(cetepSinglePath));
    assert.equal(cetepSingleWb.SheetNames[0], 'Painel Consolidado');
    assert.equal(cetepSingleWb.SheetNames.length, 2);
    const singlePanelRows = XLSX.utils.sheet_to_json(cetepSingleWb.Sheets['Painel Consolidado'], { header: 1 });
    const singleTurmaRow = singlePanelRows.find((r) => String(r[0] ?? '').includes('TURMA-SEM-M1'));
    assert.ok(singleTurmaRow);
    assert.equal(singleTurmaRow[1], 'Técnico');
    assert.equal(singleTurmaRow[2], '1ª Unidade');
    const singleTotalRow = singlePanelRows.find((r) => r[0] === 'TOTAL GERAL');
    assert.ok(singleTotalRow);
    assert.equal(singleTotalRow[1], 'Técnico');
    assert.equal(singleTotalRow[2], '—');
    assert.equal(singleTotalRow[3], 45);
    assert.equal(singleTotalRow[5], 30);
    assert.equal(singleTotalRow[6], 10);
    assert.equal(singleTotalRow[7], 5);

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

    // P1.2: Validar que <details> Mapeamento permanece aberto ao alterar seletores
    const mapWasOpen = await page.evaluate(() =>
      Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-map-details')?.hasAttribute('open'))
    );
    assert.equal(mapWasOpen, true, 'Detalhes de mapeamento deve iniciar aberto');
    await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const sel = sr.querySelector('.ps-notas-av-map');
      const prev = sel.value;
      sel.value = '';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const selAfter = sr.querySelector('.ps-notas-av-map');
      selAfter.value = prev;
      selAfter.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const mapStayedOpen = await page.evaluate(() =>
      Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-map-details')?.hasAttribute('open'))
    );
    assert.equal(mapStayedOpen, true, 'P1.2: Mapeamento deve permanecer aberto apos re-render');

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

    // 2B. P1.1: Handoff de Avaliações Não Realizadas (0,0 vs vazio / NF / Não Fez + auto-aceite #confirmationDialog no Modo Assistido)
    console.log('[E2E] 2B. Testando Avaliações Não Realizadas (0,0 vs NF / Não Fez / vazio + handoff)...');
    await page.goto(`${srv.baseUrl}/sigeduc/diario_classe/lancar_notas/form_estudantes_notas_avaliacoes_unidade.jsf`);
    await openPanel(page);
    const nrRows = [
      ['Nome', 'Participação', 'Atividade Prática', 'Seminário', 'Avaliação Escrita'],
      [FICTIONAL_STUDENTS[0].nome, '0,0', '2,5', '1,8', '3,0'], // 0,0 é nota real, NAO NR!
      [FICTIONAL_STUDENTS[1].nome, '1,5', '2,0', '1,5', '2,5'],
      [FICTIONAL_STUDENTS[2].nome, 'NF', '2,5', '1,5', '2,0'], // NF -> NR
      [FICTIONAL_STUDENTS[3].nome, 'Não Fez', '2,5', '1,5', '2,0'], // Não Fez -> NR
      [FICTIONAL_STUDENTS[4].nome, '', '2,5', '1,5', '2,0'], // vazio -> NR
    ];
    const nrWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(nrWb, XLSX.utils.aoa_to_sheet(nrRows), 'NR');
    const nrXlsxPath = path.join(userDataDir, 'notas_nao_realizadas.xlsx');
    XLSX.writeFile(nrWb, nrXlsxPath);

    await page.locator('#preenche-sigeduc-host >> #ps-notas-file').setInputFiles(nrXlsxPath);
    await page.waitForFunction(() => Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-run')));

    await page.evaluate(() => {
      document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-run').click();
    });
    await page.waitForFunction(() => Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-report')), null, { timeout: 30000 });

    const preConfirmCheck = await page.evaluate(() => ({
      st0Val: document.getElementById('formulario:resultj_id_2:0:av__8001').value,
      st2Val: document.getElementById('formulario:resultj_id_2:2:av__8001').value,
      st3Val: document.getElementById('formulario:resultj_id_2:3:av__8001').value,
      st4Val: document.getElementById('formulario:resultj_id_2:4:av__8001').value,
      hasPendingQueue: Boolean(window.sessionStorage.getItem('preenche_sigeduc_pending_nr')),
    }));
    assert.equal(preConfirmCheck.st0Val, '0.0', 'Nota 0,0 deve ser digitada como 0.0');
    assert.equal(preConfirmCheck.st2Val, '');
    assert.equal(preConfirmCheck.st3Val, '');
    assert.equal(preConfirmCheck.st4Val, '');
    assert.equal(preConfirmCheck.hasPendingQueue, true, 'Fila NR deve estar salva no sessionStorage');

    // Simular professor clicando Gravar + digitando senha no Modo Assistido
    await Promise.all([
      page.waitForURL('**/form_estudantes_realizacoes_avaliacoes_unidade.jsf', { timeout: 15000 }),
      page.evaluate(() => {
        document.getElementById('formulario:btnAbrirConfirmacaoSenha').click();
        const pwd = document.getElementById('formulario:senha');
        pwd.value = 'SenhaDocente123';
        document.getElementById('formulario:confirmarGravacaoNotas').click();
      }),
    ]);

    // Aguardar painel abrir automaticamente e marcar os checkboxes na tela de Não Realizadas
    await page.waitForFunction(() => Boolean(document.getElementById('preenche-sigeduc-host')?.shadowRoot?.getElementById('ps-nr-report')), null, { timeout: 15000 });
    const nrState = await page.evaluate(() => ({
      drawerOpen: document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-drawer').classList.contains('open'),
      reportText: document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-nr-report').textContent,
      cb0: document.getElementById('formulario:resultj_id_2:0:av__8001').checked,
      cb1: document.getElementById('formulario:resultj_id_2:1:av__8001').checked,
      cb2: document.getElementById('formulario:resultj_id_2:2:av__8001').checked,
      cb3: document.getElementById('formulario:resultj_id_2:3:av__8001').checked,
      cb4: document.getElementById('formulario:resultj_id_2:4:av__8001').checked,
      queueCleared: !window.sessionStorage.getItem('preenche_sigeduc_pending_nr'),
    }));
    assert.equal(nrState.drawerOpen, true);
    assert.equal(nrState.cb0, false, '0,0 NAO pode ser marcado como Nao Realizada');
    assert.equal(nrState.cb1, false);
    assert.equal(nrState.cb2, true, 'NF deve marcar checkbox Nao Realizada');
    assert.equal(nrState.cb3, true, 'Nao Fez deve marcar checkbox Nao Realizada');
    assert.equal(nrState.cb4, true, 'Celula vazia deve marcar checkbox Nao Realizada');
    assert.equal(nrState.queueCleared, true);
    fs.writeFileSync(
      path.join(evidenciasDir, 'relatorio_nao_realizadas.json'),
      JSON.stringify(
        {
          unidade: '3ª Unidade',
          atividade: 'Participação (id 8001, Valor: 2.0)',
          entradasPlanilha: nrRows.slice(1).map((r) => ({ estudante: r[0], valorParticipacao: r[1] })),
          resultadosCheckboxesSigeduc: {
            ANA_CLARA_FERREIRA_0_0: nrState.cb0,
            BRUNO_HENRIQUE_SOUZA_1_5: nrState.cb1,
            CARLA_MENDES_OLIVEIRA_NF: nrState.cb2,
            DANIEL_COSTA_ALMEIDA_NAO_FEZ: nrState.cb3,
            EDUARDA_RIBEIRO_SANTOS_VAZIO: nrState.cb4,
          },
          filaSessionStorageLimpa: nrState.queueCleared,
        },
        null,
        2
      ),
      'utf8'
    );
    await page.screenshot({ path: path.join(evidenciasDir, 'nao_realizadas_desktop.png') });

    // 2C. P1.3: Seleção automática de Aba + Bloco em Planilha Consolidada (múltiplas abas e múltiplas turmas na mesma aba)
    console.log('[E2E] 2C. Testando Planilha Consolidada / Multi-aba (P1.3)...');
    await page.goto(`${srv.baseUrl}/sigeduc/diario_classe/lancar_notas/form_estudantes_notas_avaliacoes_unidade.jsf`);
    await openPanel(page);

    const multiWb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      multiWb,
      XLSX.utils.aoa_to_sheet([
        ['Painel Resumo Escolar'],
        ['Escola', 'Média Geral'],
        ['ESCOLA MODELO ESTADUAL', '7.9'],
      ]),
      'Resumo'
    );
    XLSX.utils.book_append_sheet(
      multiWb,
      XLSX.utils.aoa_to_sheet([
        ['Nº', 'Nome do Aluno', 'Participação', 'Atividade Prática', 'Seminário', 'Avaliação Escrita'],
        ['1', 'OUTRO ESTUDANTE A', '2,0', '2,5', '1,8', '3,0'],
        ['2', 'OUTRO ESTUDANTE B', '1,5', '2,0', '1,5', '2,5'],
      ]),
      'Turma Outra'
    );
    XLSX.utils.book_append_sheet(
      multiWb,
      XLSX.utils.aoa_to_sheet([
        ['RELATÓRIO CONSOLIDADO DE AVALIAÇÕES — 3ª UNIDADE'],
        ['Nome da Escola', 'Total Turmas'],
        ['ESCOLA MODELO ESTADUAL', '2'],
        [],
        ['TURMA OUTRA'],
        ['Nº', 'Nome do Aluno', 'Participação', 'Atividade Prática', 'Seminário', 'Avaliação Escrita'],
        ['1', 'FULANO OUTRA TURMA 1', '1,5', '2,0', '1,0', '2,0'],
        ['2', 'BELTRANO OUTRA TURMA 2', '1,8', '2,2', '1,5', '2,5'],
        [],
        ['TURMA-ANUAL-1A'],
        ['Nº', 'Nome do Aluno', 'Participação', 'Atividade Prática', 'Seminário', 'Avaliação Escrita'],
        ...FICTIONAL_STUDENTS.slice(0, 5).map((st, idx) => [String(idx + 1), st.nome, '1,8', '2,5', '1,7', '2,8']),
      ]),
      'Consolidado'
    );
    const multiXlsxPath = path.join(userDataDir, 'notas_multi_aba_consolidado.xlsx');
    XLSX.writeFile(multiWb, multiXlsxPath);

    await page.locator('#preenche-sigeduc-host >> #ps-notas-file').setInputFiles(multiXlsxPath);
    await page.waitForFunction(() => Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-sheet-select')));

    const multiAutoState = await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const sheetSel = sr.getElementById('ps-notas-sheet-select');
      const blockSel = sr.getElementById('ps-notas-block-select');
      const matched = Number(sr.querySelector('.ps-stat[data-stat="matched"] strong')?.textContent ?? 0);
      const mapOpen = Boolean(sr.getElementById('ps-notas-map-details')?.hasAttribute('open'));
      return {
        sheetValue: sheetSel?.value,
        blockValue: blockSel?.value,
        blockText: blockSel?.options[blockSel.selectedIndex]?.text ?? '',
        matched,
        mapOpen,
      };
    });
    assert.equal(multiAutoState.sheetValue, '2', 'Deve selecionar automaticamente a aba Consolidado');
    assert.equal(multiAutoState.blockValue, 'block_1', 'Deve selecionar automaticamente o bloco TURMA-ANUAL-1A');
    assert.ok(multiAutoState.blockText.includes('TURMA-ANUAL-1A'));
    assert.equal(multiAutoState.matched, 5);
    assert.equal(multiAutoState.mapOpen, true);

    await page.screenshot({ path: path.join(evidenciasDir, 'notas_multi_aba_desktop.png') });

    // Alternar para "__all__" e voltar para o bloco da turma
    await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const blockSel = sr.getElementById('ps-notas-block-select');
      blockSel.value = '__all__';
      blockSel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const combinedStats = await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      return {
        matched: Number(sr.querySelector('.ps-stat[data-stat="matched"] strong')?.textContent ?? 0),
        issues: Number(sr.querySelector('.ps-stat[data-stat="issues"] strong')?.textContent ?? 0),
      };
    });
    assert.equal(combinedStats.matched, 5);
    assert.equal(combinedStats.issues, 2, 'Bloco combinado inclui 2 alunos da TURMA OUTRA como não encontrados');

    await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const blockSel = sr.getElementById('ps-notas-block-select');
      blockSel.value = 'block_1';
      blockSel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const backStats = await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      return Number(sr.querySelector('.ps-stat[data-stat="issues"] strong')?.textContent ?? 0);
    });
    assert.equal(backStats, 0);

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

    // 3B. P2.4 & P2.5: Extração em Lote de Todas as Turmas (Portal Docente) + Planilha Consolidada Padrão CETEP
    console.log('[E2E] 3B. Testando Extração em Lote (Ensino Médio 1ª Un. + Técnico 2ª Un.) + CETEP (.xlsx)...');
    await page.goto(`${srv.baseUrl}/sigeduc/portais/docente/docente.jsf`);
    await openPanel(page);
    await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const medioSel = sr.getElementById('ps-batch-unit-medio');
      medioSel.value = '1';
      medioSel.dispatchEvent(new Event('change', { bubbles: true }));
      const tecSel = sr.getElementById('ps-batch-unit-tecnico');
      tecSel.value = '2';
      tecSel.dispatchEvent(new Event('change', { bubbles: true }));
      const matCb = sr.getElementById('ps-batch-include-mat');
      matCb.checked = true;
      matCb.dispatchEvent(new Event('change', { bubbles: true }));
      sr.getElementById('ps-batch-start').click();
    });

    await page.waitForFunction(() => {
      const sr = document.getElementById('preenche-sigeduc-host')?.shadowRoot;
      const raw = window.sessionStorage.getItem('preenche_sigeduc_batch_extract_v1');
      if (!sr || !raw) return false;
      try {
        const st = JSON.parse(raw);
        return Boolean(sr.getElementById('ps-batch-summary')) && st.phase === 'completed' && st.autoDownloaded === true;
      } catch {
        return false;
      }
    }, null, { timeout: 45000 });

    await page.screenshot({ path: path.join(evidenciasDir, 'extracao_lote_cetep_desktop.png') });

    const loteCetepPath = path.join(evidenciasDir, 'consolidado_cetep_lote.xlsx');
    await captureDownload(
      page,
      () => page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-batch-dl-cetep').click()),
      loteCetepPath
    );

    const loteWb = XLSX.read(fs.readFileSync(loteCetepPath));
    assert.equal(loteWb.SheetNames[0], 'Painel Consolidado');
    assert.equal(loteWb.SheetNames.length, 3);
    assert.ok(loteWb.SheetNames[1].includes('1U'), 'Aba do Ensino Médio deve indicar 1U');
    assert.ok(loteWb.SheetNames[2].includes('2U'), 'Aba do Técnico deve indicar 2U');

    const lotePanel = XLSX.utils.sheet_to_json(loteWb.Sheets['Painel Consolidado'], { header: 1 });
    const subMedio = lotePanel.find((r) => r[0] === 'SUBTOTAL — ENSINO MÉDIO');
    const subTec = lotePanel.find((r) => r[0] === 'SUBTOTAL — TÉCNICO');
    assert.ok(subMedio && subTec);
    assert.equal(subMedio[2], '1ª Unidade');
    assert.equal(subMedio[5], 30);
    assert.equal(subTec[2], '2ª Unidade');
    assert.equal(subTec[5], 35);

    const loteTotal = lotePanel.find((r) => r[0] === 'TOTAL GERAL');
    assert.ok(loteTotal);
    assert.equal(loteTotal[3], 90); // 45 + 45 alunos
    assert.equal(loteTotal[4], 7.25); // média (7.0 + 7.5) / 2 = 7.25
    assert.equal(loteTotal[5], 65); // 30 + 35 aprovados
    assert.equal(loteTotal[6], 15); // 10 + 5 recuperação
    assert.equal(loteTotal[7], 10); // 5 + 5 sem nota

    const t1Rows = XLSX.utils.sheet_to_json(loteWb.Sheets[loteWb.SheetNames[1]], { header: 1 });
    assert.equal(t1Rows[4][1], 'ANA CLARA FERREIRA');
    assert.equal(t1Rows[4][2], '202690010001', 'Matrícula deve ser coletada automaticamente via tela de Frequência');
    assert.ok(t1Rows.some((r) => r[1] === 'MÉDIA DA TURMA'));

    // Também validar download em Aba Única Consolidada
    const singleCetepPath = path.join(userDataDir, 'consolidado_cetep_aba_unica.xlsx');
    await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const modeSel = sr.getElementById('ps-cetep-mode');
      modeSel.value = 'single_sheet';
      modeSel.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await captureDownload(
      page,
      () => page.evaluate(() => document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-batch-dl-cetep').click()),
      singleCetepPath
    );
    const singleLoteWb = XLSX.read(fs.readFileSync(singleCetepPath));
    assert.deepEqual(singleLoteWb.SheetNames, ['Consolidado CETEP']);

    // Limpar estado batch da sessionStorage antes do teste Mobile
    await page.evaluate(() => {
      document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-batch-reset').click();
    });

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
    const cetepMobileVisible = await page.evaluate(() => {
      const btn = document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-cetep-dl-single');
      const rect = btn.getBoundingClientRect();
      return { bottom: rect.bottom, viewportHeight: window.innerHeight };
    });
    assert.ok(
      cetepMobileVisible.bottom <= cetepMobileVisible.viewportHeight,
      `Botão CETEP no mobile deve caber acima da dobra (${cetepMobileVisible.bottom} <= ${cetepMobileVisible.viewportHeight})`
    );
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

    // 5. P2.1 & P2.2: Escala de Fonte (100% -> 112% -> 125%) + Dark Mode persistentes no header (mobile 390x844)
    console.log('[E2E] 5. Testando Escala de Fonte (125%) e Modo Escuro no header (mobile 390x844)...');
    await page.goto(`${srv.baseUrl}/sigeduc/diario_classe/lancar_notas/form_estudantes_notas_avaliacoes_unidade.jsf`);
    await openPanel(page);
    await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      sr.getElementById('ps-font-btn').click(); // 100 -> 112
      sr.getElementById('ps-font-btn').click(); // 112 -> 125
      sr.getElementById('ps-theme-btn').click(); // light -> dark
    });
    const prefsApplied = await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const drawer = sr.getElementById('ps-drawer');
      return {
        isDark: drawer.classList.contains('ps-dark'),
        is125: drawer.classList.contains('ps-scale-125'),
        lsTheme: window.localStorage.getItem('preenche_sigeduc_theme'),
        lsScale: window.localStorage.getItem('preenche_sigeduc_font_scale'),
      };
    });
    assert.equal(prefsApplied.isDark, true);
    assert.equal(prefsApplied.is125, true);
    assert.equal(prefsApplied.lsTheme, 'dark');
    assert.equal(prefsApplied.lsScale, '125');

    // Recarregar para confirmar persistência + carregar planilha com tema escuro + 125% sem overflow
    await page.reload();
    await openPanel(page);
    await page.locator('#preenche-sigeduc-host >> #ps-notas-file').setInputFiles(mixedXlsxPath);
    await page.waitForFunction(() => Boolean(document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-run')));
    const darkMobileLayout = await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const drawer = sr.getElementById('ps-drawer');
      const body = sr.getElementById('ps-body');
      return {
        isDark: drawer.classList.contains('ps-dark'),
        is125: drawer.classList.contains('ps-scale-125'),
        bodyOverflowX: body.scrollWidth > body.clientWidth + 1,
        hasOuterVScroll: window.innerWidth - document.documentElement.clientWidth > 0,
        hasOuterHScroll: window.innerHeight - document.documentElement.clientHeight > 0,
      };
    });
    assert.equal(darkMobileLayout.isDark, true);
    assert.equal(darkMobileLayout.is125, true);
    assert.equal(darkMobileLayout.bodyOverflowX, false);
    assert.equal(darkMobileLayout.hasOuterVScroll, false);
    assert.equal(darkMobileLayout.hasOuterHScroll, false);
    await page.screenshot({ path: path.join(evidenciasDir, 'notas_dark_mode_mobile.png') });

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
