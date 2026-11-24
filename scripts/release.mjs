import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export function computeNextVersion(currentVersion, spec) {
  const curMatch = String(currentVersion ?? '').trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!curMatch) {
    throw new Error(`Versão atual inválida em package.json: "${currentVersion}"`);
  }
  const major = Number(curMatch[1]);
  const minor = Number(curMatch[2]);
  const patch = Number(curMatch[3]);

  const target = String(spec ?? 'patch').trim();
  if (target === 'patch') return `${major}.${minor}.${patch + 1}`;
  if (target === 'minor') return `${major}.${minor + 1}.0`;
  if (target === 'major') return `${major + 1}.0.0`;

  const explicit = target.replace(/^v/i, '');
  if (!/^\d+\.\d+\.\d+$/.test(explicit)) {
    throw new Error(`Especificação de versão inválida: "${spec}". Use patch, minor, major ou X.Y.Z.`);
  }
  return explicit;
}

function runCmd(cmd, args, { capture = false } = {}) {
  const needsShell = process.platform === 'win32' && cmd === 'npm';
  const res = spawnSync(cmd, args, {
    cwd: rootDir,
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
    shell: needsShell,
  });
  if (res.status !== 0) {
    const extra = capture && res.stderr ? `\n${res.stderr.trim()}` : '';
    throw new Error(`Comando falhou (${cmd} ${args.join(' ')})${extra}`);
  }
  return capture ? (res.stdout ?? '').trim() : '';
}

function resolveGhBinary() {
  const winDefault = 'C:\\Program Files\\GitHub CLI\\gh.exe';
  if (process.platform === 'win32' && fs.existsSync(winDefault)) {
    return winDefault;
  }
  return 'gh';
}

function main() {
  const rawArgs = process.argv.slice(2);
  const dryRun = rawArgs.includes('--dry-run');
  const noWatch = rawArgs.includes('--no-watch');
  const spec = rawArgs.find((a) => !a.startsWith('--')) ?? 'patch';

  const pkgPath = path.join(rootDir, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const nextVersion = computeNextVersion(pkg.version, spec);
  const tagName = `v${nextVersion}`;

  const dirty = runCmd('git', ['status', '--porcelain'], { capture: true });
  if (dirty && !dryRun) {
    throw new Error('Árvore Git possui alterações não commitadas. Faça commit ou stash antes de iniciar uma release.');
  }

  const existingTag = runCmd('git', ['tag', '-l', tagName], { capture: true });
  if (existingTag === tagName) {
    throw new Error(`A tag ${tagName} já existe localmente.`);
  }

  console.log(`[release] Versão atual: ${pkg.version} -> Próxima versão: ${nextVersion} (tag: ${tagName})`);
  if (dryRun) {
    console.log('[release] Modo --dry-run: nenhuma alteração aplicada.');
    console.log('  1. Executar `npm run harness`');
    console.log(`  2. Atualizar package.json/package-lock.json para ${nextVersion}`);
    console.log('  3. Executar `npm run build && npm run package`');
    console.log(`  4. Commit + tag ${tagName} + git push origin main ${tagName}`);
    return;
  }

  console.log('[release] 1/4 Executando portões do harness...');
  runCmd('npm', ['run', 'harness']);

  console.log(`[release] 2/4 Atualizando versão para ${nextVersion}...`);
  runCmd('npm', ['version', nextVersion, '--no-git-tag-version']);
  runCmd('npm', ['run', 'build']);
  runCmd('npm', ['run', 'package']);

  console.log(`[release] 3/4 Criando commit e tag ${tagName}...`);
  runCmd('git', ['add', 'package.json', 'package-lock.json']);
  runCmd('git', ['commit', '-m', `chore(release): publica versão ${tagName}`]);
  runCmd('git', ['tag', tagName]);

  console.log(`[release] 4/4 Enviando main e ${tagName} para origin...`);
  runCmd('git', ['push', 'origin', 'main']);
  runCmd('git', ['push', 'origin', tagName]);

  if (!noWatch) {
    const ghBin = resolveGhBinary();
    try {
      runCmd(ghBin, ['run', 'list', '--limit', '2']);
    } catch {
      console.log('[release] Push concluído; acompanhe a compilação no GitHub Actions do repositório.');
    }
  }
}

const isEntrypoint = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntrypoint) {
  try {
    main();
  } catch (err) {
    console.error('[release] FALHA:', err.message);
    process.exitCode = 1;
  }
}
