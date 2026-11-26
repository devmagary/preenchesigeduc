import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCrx3Buffer } from '../scripts/crx3.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const evidenciasDir = path.join(rootDir, 'trabalho', 'evidencias');

const STEPS = [
  { name: 'typecheck', cmd: 'npx', args: ['tsc', '--noEmit'] },
  { name: 'build', cmd: 'npm', args: ['run', 'build'] },
  { name: 'package', cmd: 'npm', args: ['run', 'package'] },
  { name: 'unit_tests', cmd: 'npm', args: ['run', 'test:unit'] },
  { name: 'benchmark', cmd: 'npm', args: ['run', 'benchmark'] },
  { name: 'e2e_tests', cmd: 'npm', args: ['run', 'test:e2e'] },
];

const EXPECTED_EVIDENCES = [
  'scraping_turmas_desktop.png',
  'cards_turmas_longos_desktop.png',
  'extracao_lote_cetep_desktop.png',
  'notas_previa_desktop.png',
  'notas_multi_aba_desktop.png',
  'notas_relatorio_desktop.png',
  'nao_realizadas_desktop.png',
  'notas_previa_mobile.png',
  'notas_dark_mode_mobile.png',
  'sobre_privacidade_mobile.png',
  'frequencia_dia_unico_desktop.png',
  'frequencia_multiplas_datas_desktop.png',
  'frequencia_mobile.png',
  'scraping_notas_mobile.png',
  'export_turmas.xlsx',
  'export_turmas.csv',
  'export_turmas.json',
  'export_avaliacoes.json',
  'consolidado_cetep_lote.xlsx',
  'consolidado_cetep_ativo_mat.xlsx',
  'consolidado_cetep_res_final.xlsx',
  'modelo_notas_semestral.xlsx',
  'modelo_frequencia.xlsx',
  'relatorio_execucao_notas_completo.json',
  'relatorio_nao_realizadas.json',
  'relatorio_execucao_frequencia.json',
];

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function runStep(step) {
  console.log(`\n[HARNESS] Executando etapa: ${step.name} (${step.cmd} ${step.args.join(' ')})`);
  const t0 = performance.now();
  const isWin = process.platform === 'win32';
  const res = spawnSync(step.cmd, step.args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWin,
  });
  const elapsedMs = Number((performance.now() - t0).toFixed(1));
  if (res.status !== 0) {
    throw new Error(`Etapa "${step.name}" falhou com exit code ${res.status}`);
  }
  return { name: step.name, status: 'passed', elapsedMs };
}

function validateSlasAndManifest() {
  const metricsPath = path.join(rootDir, 'trabalho', 'relatorio_metricas.json');
  if (!fs.existsSync(metricsPath)) {
    throw new Error('trabalho/relatorio_metricas.json não encontrado.');
  }
  const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));

  const slaChecks = {
    parse500x10_p99_lt_250ms: Boolean(metrics.parse500x10_20runs?.passed),
    panelOpen_lt_100ms: Number(metrics.panelOpen_ms) < 100,
    ajaxLossRate_0pct: Number(metrics.sequentialFill_45x4?.ajaxLossRatePct) === 0,
    matching_exact_45_and_0_fp:
      metrics.sequentialFill_45x4?.exactMatched === 45 &&
      metrics.sequentialFill_45x4?.falsePositives === 0,
    bundles_lt_1536KB: Boolean(metrics.bundleSizes_KB?.passed),
    packages_lt_512KB:
      Number(metrics.bundleSizes_KB?.chromeZip_KB) > 0 &&
      Number(metrics.bundleSizes_KB?.chromeZip_KB) < 512 &&
      Number(metrics.bundleSizes_KB?.firefoxZip_KB) > 0 &&
      Number(metrics.bundleSizes_KB?.firefoxZip_KB) < 512 &&
      Number(metrics.bundleSizes_KB?.edgeCrx_KB) > 0 &&
      Number(metrics.bundleSizes_KB?.edgeCrx_KB) < 512,
  };

  for (const [k, ok] of Object.entries(slaChecks)) {
    if (!ok) throw new Error(`Portão de SLA reprovado: ${k}`);
  }

  // Verificar isolamento de produção: dist/chrome e dist/firefox não podem conter http://127.0.0.1
  for (const target of ['chrome', 'firefox']) {
    const mPath = path.join(rootDir, 'dist', target, 'manifest.json');
    const manifestTxt = fs.readFileSync(mPath, 'utf8');
    if (manifestTxt.includes('127.0.0.1')) {
      throw new Error(`dist/${target}/manifest.json vazou URL local 127.0.0.1!`);
    }
    const trabalhoInDist = path.join(rootDir, 'dist', target, 'trabalho');
    if (fs.existsSync(trabalhoInDist)) {
      throw new Error(`dist/${target} contém pasta trabalho/ indevidamente!`);
    }
    for (const file of fs.readdirSync(path.join(rootDir, 'dist', target))) {
      if (file.endsWith('.pem') || file.endsWith('.key')) {
        throw new Error(`dist/${target} contém chave privada ${file} indevidamente!`);
      }
    }
  }

  // Verificar pacote CRX3 assinado para Edge Mobile
  const edgeCrxPath = path.join(rootDir, 'dist', 'preenche-sigeduc-edge-mobile.crx');
  if (!fs.existsSync(edgeCrxPath)) {
    throw new Error('dist/preenche-sigeduc-edge-mobile.crx não foi gerado!');
  }
  const crxCheck = verifyCrx3Buffer(fs.readFileSync(edgeCrxPath));
  if (!crxCheck.valid) {
    throw new Error(`dist/preenche-sigeduc-edge-mobile.crx inválido: ${crxCheck.reason}`);
  }

  // Verificar hashes SHA-256 dos pacotes .zip/.crx em dist/ contra relatorio_metricas.json (CR-010)
  const expectedPkgHashes = {
    chromeZip: path.join(rootDir, 'dist', 'preenche-sigeduc-chrome.zip'),
    firefoxZip: path.join(rootDir, 'dist', 'preenche-sigeduc-firefox.zip'),
    edgeCrx: edgeCrxPath,
  };
  for (const [k, absPath] of Object.entries(expectedPkgHashes)) {
    const recorded = metrics.bundleSizes_KB?.packages_sha256?.[k];
    const actual = sha256File(absPath);
    if (!recorded || recorded !== actual) {
      throw new Error(`Hash SHA-256 divergente para pacote ${k}: esperado=${recorded}, atual=${actual}`);
    }
  }

  // Verificar evidências obrigatórias
  const missing = [];
  const manifestFiles = [];
  for (const rel of EXPECTED_EVIDENCES) {
    const abs = path.join(evidenciasDir, rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).size === 0) {
      missing.push(rel);
    } else {
      manifestFiles.push({
        file: rel,
        path: abs,
        bytes: fs.statSync(abs).size,
        sha256: sha256File(abs),
      });
    }
  }

  if (missing.length > 0) {
    throw new Error(`Evidências obrigatórias ausentes ou vazias: ${missing.join(', ')}`);
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    evidenciasDir,
    files: manifestFiles,
  };
  fs.writeFileSync(path.join(evidenciasDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Auditar acúmulo de achados "menor" do Crítico Independente
  const backlogPath = path.join(rootDir, 'trabalho', 'critico_backlog.json');
  if (!fs.existsSync(backlogPath)) {
    throw new Error('trabalho/critico_backlog.json não encontrado para auditoria de achados menores.');
  }
  const backlog = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));
  const items = Array.isArray(backlog.items) ? backlog.items : [];
  const maxOpenAllowed = Number.isFinite(backlog.maxOpenMinorAllowed) ? backlog.maxOpenMinorAllowed : 5;
  const seenIds = new Set();

  let resolvedCount = 0;
  let acceptedDesignCount = 0;
  let openCount = 0;

  for (const item of items) {
    if (!item.id || seenIds.has(item.id)) {
      throw new Error(`ID duplicado ou ausente em critico_backlog.json: ${item.id}`);
    }
    seenIds.add(item.id);

    if (item.status === 'resolvido') {
      resolvedCount++;
      if (!item.resolutionNote || !item.testFile || !item.testPattern) {
        throw new Error(`Item ${item.id} marcado como resolvido sem resolutionNote/testFile/testPattern.`);
      }
      const absTest = path.join(rootDir, item.testFile);
      if (!fs.existsSync(absTest)) {
        throw new Error(`Item ${item.id} aponta para arquivo de teste inexistente: ${item.testFile}`);
      }
      const testTxt = fs.readFileSync(absTest, 'utf8');
      if (!testTxt.includes(item.testPattern)) {
        throw new Error(`Item ${item.id}: padrão de teste "${item.testPattern}" não encontrado em ${item.testFile}`);
      }
    } else if (item.status === 'aceito_design') {
      acceptedDesignCount++;
      if (!item.justification) {
        throw new Error(`Item ${item.id} marcado como aceito_design sem justification.`);
      }
      if (item.testFile && item.testPattern) {
        const absTest = path.join(rootDir, item.testFile);
        if (!fs.existsSync(absTest) || !fs.readFileSync(absTest, 'utf8').includes(item.testPattern)) {
          throw new Error(`Item ${item.id} possui teste vinculado inválido em ${item.testFile}`);
        }
      }
    } else if (item.status === 'aberto' || item.status === 'agendado') {
      openCount++;
      if (item.status === 'agendado' && !item.resolutionNote) {
        throw new Error(`Item ${item.id} está agendado sem resolutionNote em critico_backlog.json.`);
      }
    } else {
      throw new Error(`Status inválido em critico_backlog.json (${item.id}): ${item.status}`);
    }
  }

  if (openCount > maxOpenAllowed) {
    throw new Error(`Acúmulo de achados "menor" excedeu o teto (${openCount} > ${maxOpenAllowed}). Resolva ou triaje itens em trabalho/critico_backlog.json.`);
  }

  const backlogMdLines = [
    '# Backlog Auditado de Achados "Menor" — Crítico Independente',
    '',
    `Atualizado automaticamente pelo harness em: ${new Date().toISOString()}`,
    '',
    `- **Total catalogado:** ${items.length}`,
    `- **Resolvidos (com teste verificado):** ${resolvedCount}`,
    `- **Aceitos por design:** ${acceptedDesignCount}`,
    `- **Abertos / Agendados:** ${openCount} (limite máximo: ${maxOpenAllowed})`,
    '',
    '| ID | Rodada | Status | Título | Teste / Verificação Vinculada |',
    '| :--- | :---: | :---: | :--- | :--- |',
    ...items.map(
      (i) =>
        `| **${i.id}** | ${i.round} | \`${i.status}\` | ${i.title} | ${i.testFile ? `\`${i.testFile}\` (\`${i.testPattern}\`)` : '—'} |`
    ),
    '',
  ];
  fs.writeFileSync(path.join(rootDir, 'trabalho', 'critico_backlog.md'), backlogMdLines.join('\n'), 'utf8');

  const minorBacklog = {
    total: items.length,
    resolved: resolvedCount,
    acceptedDesign: acceptedDesignCount,
    open: openCount,
    maxOpenAllowed,
    allResolvedTestsVerified: true,
  };

  return { slaChecks, metrics, evidenceCount: manifestFiles.length, minorBacklog };
}

async function main() {
  const startedAt = new Date().toISOString();
  const stepResults = [];

  for (const step of STEPS) {
    stepResults.push(runStep(step));
  }

  const validation = validateSlasAndManifest();
  const statusReport = {
    startedAt,
    finishedAt: new Date().toISOString(),
    overallStatus: 'PASSED',
    steps: stepResults,
    slaChecks: validation.slaChecks,
    evidenceCount: validation.evidenceCount,
    minorBacklog: validation.minorBacklog,
  };

  fs.writeFileSync(
    path.join(rootDir, 'trabalho', 'harness_status.json'),
    JSON.stringify(statusReport, null, 2)
  );

  console.log('\n[HARNESS] TODOS OS PORTÕES AUTOMATIZADOS PASSARAM!');
  console.log(`[HARNESS] Evidências validadas: ${validation.evidenceCount}/${EXPECTED_EVIDENCES.length}`);
  console.log(
    `[HARNESS] Backlog menor auditado: ${validation.minorBacklog.resolved} resolvidos, ${validation.minorBacklog.acceptedDesign} aceitos por design, ${validation.minorBacklog.open}/${validation.minorBacklog.maxOpenAllowed} abertos`
  );
}

main().catch((err) => {
  console.error('\n[HARNESS] FALHA:', err.message);
  process.exitCode = 1;
});
