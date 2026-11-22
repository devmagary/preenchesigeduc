import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  'notas_previa_desktop.png',
  'notas_multi_aba_desktop.png',
  'notas_relatorio_desktop.png',
  'nao_realizadas_desktop.png',
  'notas_previa_mobile.png',
  'notas_dark_mode_mobile.png',
  'frequencia_dia_unico_desktop.png',
  'frequencia_multiplas_datas_desktop.png',
  'frequencia_mobile.png',
  'scraping_notas_mobile.png',
  'export_turmas.xlsx',
  'export_turmas.csv',
  'export_turmas.json',
  'export_avaliacoes.json',
  'modelo_notas_semestral.xlsx',
  'modelo_frequencia.xlsx',
  'relatorio_execucao_notas_completo.json',
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

  return { slaChecks, metrics, evidenceCount: manifestFiles.length };
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
  };

  fs.writeFileSync(
    path.join(rootDir, 'trabalho', 'harness_status.json'),
    JSON.stringify(statusReport, null, 2)
  );

  console.log('\n[HARNESS] TODOS OS PORTÕES AUTOMATIZADOS PASSARAM!');
  console.log(`[HARNESS] Evidências validadas: ${validation.evidenceCount}/${EXPECTED_EVIDENCES.length}`);
}

main().catch((err) => {
  console.error('\n[HARNESS] FALHA:', err.message);
  process.exitCode = 1;
});
