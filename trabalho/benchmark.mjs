import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import * as XLSX from 'xlsx';
import { startMockServer } from './mock-server.mjs';
import { FICTIONAL_STUDENTS } from './generate-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const extE2eDir = path.join(rootDir, 'trabalho', 'dist-e2e');

function getDirSizeBytes(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? getDirSizeBytes(full) : fs.statSync(full).size;
  }
  return total;
}

function stats(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const p99Idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.99) - 1);
  return {
    avg: Number((sum / sorted.length).toFixed(2)),
    p99: Number(sorted[p99Idx].toFixed(2)),
    max: Number(sorted[sorted.length - 1].toFixed(2)),
  };
}

function build500x10Buffers() {
  const headers = ['Matrícula', 'Nome', 'Ativ 1', 'Ativ 2', 'Ativ 3', 'Ativ 4', 'Ativ 5', 'Ativ 6', 'Ativ 7', 'Ativ 8'];
  const aoa = [headers];
  for (let i = 0; i < 500; i++) {
    aoa.push([
      `2026${String(i).padStart(6, '0')}`,
      `ESTUDANTE BENCHMARK ${i}`,
      '2.0', '2.5', '1.5', '3.0', '1.0', '2.0', '2.5', '3.0',
    ]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, 'Notas');
  const xlsxBuf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const csvStr = '\uFEFF' + aoa.map((r) => r.join(';')).join('\r\n');
  return { xlsxBuf, csvStr };
}

async function run() {
  // 1. Parse benchmark (via SheetJS direto + parse CSV equivalente ao bundle)
  const { xlsxBuf, csvStr } = build500x10Buffers();
  const xlsxTimes = [];
  const csvTimes = [];

  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    const wb = XLSX.read(xlsxBuf, { type: 'buffer', cellDates: false });
    XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
    xlsxTimes.push(performance.now() - t0);

    const c0 = performance.now();
    const lines = csvStr.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
    lines.map((l) => l.split(';'));
    csvTimes.push(performance.now() - c0);
  }

  const xlsxStats = stats(xlsxTimes);
  const csvStats = stats(csvTimes);

  // 2. Browser E2E benchmark: panel open + 45x4 sequential AJAX fill + matching precision
  const srv = await startMockServer({ ajaxDelayMs: 25 });
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preenche-bench-'));
  let context;
  let panelOpenMs = 0;
  let ajaxExpected = 180;
  let ajaxReceived = 0;
  let fillDurationMs = 0;
  let exactMatched = 0;
  let falsePositives = 0;

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      executablePath: chromePath,
      headless: false,
      ignoreDefaultArgs: ['--disable-extensions'],
      viewport: { width: 1280, height: 720 },
      args: [
        '--headless=new',
        '--enable-unsafe-extension-debugging',
        '--no-sandbox',
      ],
    });
    const bCdp = await context.browser().newBrowserCDPSession();
    await bCdp.send('Extensions.loadUnpacked', { path: extE2eDir });

    const page = await context.newPage();
    await page.goto(`${srv.baseUrl}/sigeduc/diario_classe/lancar_notas/form_estudantes_notas_avaliacoes_unidade.jsf`);
    await page.waitForSelector('#preenche-sigeduc-host', { state: 'attached', timeout: 10000 });

    // Medir tempo de abertura do painel
    const tOpen0 = performance.now();
    await page.evaluate(() => {
      const host = document.getElementById('preenche-sigeduc-host');
      host.shadowRoot.getElementById('ps-fab-btn').click();
    });
    await page.waitForFunction(() => {
      const host = document.getElementById('preenche-sigeduc-host');
      return host?.shadowRoot?.getElementById('ps-drawer')?.classList.contains('open');
    });
    panelOpenMs = Number((performance.now() - tOpen0).toFixed(2));

    // Preparar CSV com 45 alunos exatos + 2 nomes divergentes (1 letra trocada)
    const csvLines = ['Nome;Participação;Atividade Prática;Seminário;Avaliação Escrita'];
    for (const st of FICTIONAL_STUDENTS) {
      csvLines.push(`${st.nome};1,5;2,5;1,8;2,7`);
    }
    csvLines.push('ANA CLARA FERREIRO;2,0;3,0;2,0;3,0'); // typo -> não deve casar
    csvLines.push('ALUNO INEXISTENTE TESTE;1,0;1,0;1,0;1,0');

    const benchCsvPath = path.join(userDataDir, 'bench_45x4.csv');
    fs.writeFileSync(benchCsvPath, '\uFEFF' + csvLines.join('\r\n'), 'utf8');

    const fileInput = page.locator('#preenche-sigeduc-host >> #ps-notas-file');
    await fileInput.setInputFiles(benchCsvPath);

    await page.waitForFunction(() => {
      const host = document.getElementById('preenche-sigeduc-host');
      return Boolean(host?.shadowRoot?.getElementById('ps-notas-run'));
    });

    const previewCounts = await page.evaluate(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      const getStat = (key) => Number(sr.querySelector(`.ps-stat[data-stat="${key}"] strong`)?.textContent ?? 0);
      return {
        matched: getStat('matched'),
        issues: getStat('issues'),
      };
    });
    exactMatched = previewCounts.matched;
    const unmatchedCount = previewCounts.issues;
    falsePositives = exactMatched === 45 && unmatchedCount === 2 ? 0 : 1;

    await fetch(`${srv.baseUrl}/__reset`);
    const tFill0 = performance.now();
    await page.evaluate(() => {
      document.getElementById('preenche-sigeduc-host').shadowRoot.getElementById('ps-notas-run').click();
    });
    await page.waitForFunction(() => {
      const sr = document.getElementById('preenche-sigeduc-host').shadowRoot;
      return Boolean(sr?.getElementById('ps-notas-report'));
    }, null, { timeout: 60000 });
    fillDurationMs = Number((performance.now() - tFill0).toFixed(2));

    const mResp = await (await fetch(`${srv.baseUrl}/__metrics`)).json();
    ajaxReceived = mResp.notasAjaxCount;
  } finally {
    if (context) await context.close();
    await srv.close();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // ignore transient Windows file lock on temp profile cleanup
    }
  }

  const ajaxLossRatePct = Number((((ajaxExpected - ajaxReceived) / ajaxExpected) * 100).toFixed(2));

  const chromeDirKB = Number((getDirSizeBytes(path.join(rootDir, 'dist', 'chrome')) / 1024).toFixed(1));
  const firefoxDirKB = Number((getDirSizeBytes(path.join(rootDir, 'dist', 'firefox')) / 1024).toFixed(1));
  const chromeZipKB = Number((fs.statSync(path.join(rootDir, 'dist', 'preenche-sigeduc-chrome.zip')).size / 1024).toFixed(1));
  const firefoxZipKB = Number((fs.statSync(path.join(rootDir, 'dist', 'preenche-sigeduc-firefox.zip')).size / 1024).toFixed(1));

  const report = {
    generatedAt: new Date().toISOString(),
    parse500x10_20runs: {
      xlsx_ms: xlsxStats,
      csv_ms: csvStats,
      sla_limit_ms: 250,
      passed: xlsxStats.p99 < 250 && csvStats.p99 < 250,
    },
    panelOpen_ms: panelOpenMs,
    panelOpen_sla_ms: 100,
    sequentialFill_45x4: {
      expectedAjax: ajaxExpected,
      receivedAjax: ajaxReceived,
      ajaxLossRatePct,
      duration_ms: fillDurationMs,
      exactMatched,
      falsePositives,
      passed: ajaxLossRatePct === 0 && exactMatched === 45 && falsePositives === 0,
    },
    bundleSizes_KB: {
      distChrome_KB: chromeDirKB,
      distFirefox_KB: firefoxDirKB,
      chromeZip_KB: chromeZipKB,
      firefoxZip_KB: firefoxZipKB,
      sla_uncompressed_limit_KB: 1536,
      passed: chromeDirKB < 1536 && firefoxDirKB < 1536,
    },
  };

  fs.writeFileSync(path.join(rootDir, 'trabalho', 'relatorio_metricas.json'), JSON.stringify(report, null, 2));

  const md = `# Relatório de Métricas e SLA — Preenche SIGEduc

Gerado em: ${report.generatedAt}

## 1. Parse de Planilha (500 linhas × 10 colunas, 20 execuções)

| Formato | Média (ms) | p99 (ms) | Máximo (ms) | Meta SLA | Status |
| :--- | ---: | ---: | ---: | :---: | :---: |
| **.xlsx** | ${xlsxStats.avg} | ${xlsxStats.p99} | ${xlsxStats.max} | < 250 ms | ${xlsxStats.p99 < 250 ? 'PASSOU' : 'FALHOU'} |
| **.csv** | ${csvStats.avg} | ${csvStats.p99} | ${csvStats.max} | < 250 ms | ${csvStats.p99 < 250 ? 'PASSOU' : 'FALHOU'} |

## 2. Preenchimento Sequencial AJAX & Matching (45 alunos × 4 atividades + 2 divergentes)

- **Tempo de abertura do painel Shadow DOM:** ${panelOpenMs} ms (Meta: < 100 ms)
- **Eventos \`onblur\` AJAX esperados:** ${ajaxExpected}
- **Eventos \`onblur\` AJAX recebidos pelo servidor mock:** ${ajaxReceived}
- **Taxa de perda de eventos AJAX:** ${ajaxLossRatePct}% (Meta: 0%)
- **Tempo total do lote sequencial (com latência mock 25ms/req):** ${fillDurationMs} ms
- **Precisão de matching:** ${exactMatched}/45 exatos, ${falsePositives} falsos positivos (Meta: 100% exatos, 0 falsos positivos)

## 3. Tamanho Final dos Pacotes

| Artefato | Tamanho (KB) | Meta SLA | Status |
| :--- | ---: | :---: | :---: |
| \`dist/chrome/\` (descompactado) | ${chromeDirKB} KB | < 1536 KB | ${chromeDirKB < 1536 ? 'PASSOU' : 'FALHOU'} |
| \`dist/firefox/\` (descompactado) | ${firefoxDirKB} KB | < 1536 KB | ${firefoxDirKB < 1536 ? 'PASSOU' : 'FALHOU'} |
| \`dist/preenche-sigeduc-chrome.zip\` | ${chromeZipKB} KB | — | OK |
| \`dist/preenche-sigeduc-firefox.zip\` | ${firefoxZipKB} KB | — | OK |
`;

  fs.writeFileSync(path.join(rootDir, 'trabalho', 'relatorio_metricas.md'), md, 'utf8');
  console.log(md);

  if (
    !report.parse500x10_20runs.passed ||
    !report.sequentialFill_45x4.passed ||
    !report.bundleSizes_KB.passed ||
    panelOpenMs >= 100
  ) {
    process.exitCode = 1;
  }
}

await run();
