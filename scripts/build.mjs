import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { generateIcons } from './generate-icons.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const distChrome = path.join(rootDir, 'dist', 'chrome');
const distFirefox = path.join(rootDir, 'dist', 'firefox');
const distE2E = path.join(rootDir, 'trabalho', 'dist-e2e');
const stageDir = path.join(rootDir, 'trabalho', '.build-stage');

function createManifest({ firefox = false, e2e = false } = {}) {
  const matches = e2e
    ? ['https://sigeduc.educacao.ba.gov.br/sigeduc/*', 'http://127.0.0.1/*']
    : ['https://sigeduc.educacao.ba.gov.br/sigeduc/*'];
  const warMatches = e2e
    ? ['https://sigeduc.educacao.ba.gov.br/*', 'http://127.0.0.1/*']
    : ['https://sigeduc.educacao.ba.gov.br/*'];

  const manifest = {
    manifest_version: 3,
    name: 'Preenche SIGEduc',
    version: '1.0.0',
    description:
      'Importa planilhas de notas e frequências para preenchimento assistido no SIGEduc-BA e extrai turmas, alunos e atividades.',
    permissions: ['activeTab'],
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    action: {
      default_title: 'Preenche SIGEduc',
      default_popup: 'popup.html',
      default_icon: {
        16: 'icons/icon16.png',
        48: 'icons/icon48.png',
        128: 'icons/icon128.png',
      },
    },
    content_scripts: [
      {
        matches,
        js: ['content.js'],
        run_at: 'document_idle',
      },
    ],
    web_accessible_resources: [
      {
        resources: ['page-bridge.js'],
        matches: warMatches,
      },
    ],
  };

  if (firefox) {
    manifest.browser_specific_settings = {
      gecko: {
        id: 'preenche-sigeduc@local.dev',
        strict_min_version: '113.0',
      },
      gecko_android: {
        strict_min_version: '120.0',
      },
    };
  }

  return manifest;
}

async function bundleEntry(entryRelative, outName, globalName) {
  await build({
    root: rootDir,
    logLevel: 'warn',
    configFile: false,
    build: {
      outDir: stageDir,
      emptyOutDir: false,
      sourcemap: false,
      minify: 'esbuild',
      target: 'es2022',
      lib: {
        entry: path.join(rootDir, entryRelative),
        name: globalName,
        formats: ['iife'],
        fileName: () => outName,
      },
      rollupOptions: {
        output: {
          inlineDynamicImports: true,
        },
      },
    },
  });
}

function copyDirContents(srcDir, destDir) {
  fs.rmSync(destDir, { recursive: true, force: true });
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirContents(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

export function getDirSizeBytes(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getDirSizeBytes(full);
    } else {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

async function runBuild() {
  fs.rmSync(stageDir, { recursive: true, force: true });
  fs.mkdirSync(stageDir, { recursive: true });

  await bundleEntry('src/content.ts', 'content.js', 'PreencheSigeducContent');
  await bundleEntry('src/page-bridge.ts', 'page-bridge.js', 'PreencheSigeducBridge');
  await bundleEntry('src/popup/popup.ts', 'popup.js', 'PreencheSigeducPopup');

  fs.copyFileSync(path.join(rootDir, 'src/popup/popup.html'), path.join(stageDir, 'popup.html'));
  fs.copyFileSync(path.join(rootDir, 'src/popup/popup.css'), path.join(stageDir, 'popup.css'));
  generateIcons(stageDir);

  // Copy to targets
  copyDirContents(stageDir, distChrome);
  fs.writeFileSync(
    path.join(distChrome, 'manifest.json'),
    JSON.stringify(createManifest({ firefox: false, e2e: false }), null, 2)
  );

  copyDirContents(stageDir, distFirefox);
  fs.writeFileSync(
    path.join(distFirefox, 'manifest.json'),
    JSON.stringify(createManifest({ firefox: true, e2e: false }), null, 2)
  );

  copyDirContents(stageDir, distE2E);
  fs.writeFileSync(
    path.join(distE2E, 'manifest.json'),
    JSON.stringify(createManifest({ firefox: false, e2e: true }), null, 2)
  );

  fs.rmSync(stageDir, { recursive: true, force: true });

  const chromeKB = (getDirSizeBytes(distChrome) / 1024).toFixed(1);
  const firefoxKB = (getDirSizeBytes(distFirefox) / 1024).toFixed(1);
  console.log(`[build] dist/chrome:  ${chromeKB} KB`);
  console.log(`[build] dist/firefox: ${firefoxKB} KB`);
  console.log(`[build] trabalho/dist-e2e pronto.`);
}

await runBuild();

if (process.argv.includes('--watch')) {
  console.log('[build] Observando alterações em src/ ...');
  let timer = null;
  fs.watch(path.join(rootDir, 'src'), { recursive: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      runBuild().catch((err) => console.error('[build] Erro:', err));
    }, 250);
  });
}
