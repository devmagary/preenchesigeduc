import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function getDirSizeBytes(dir) {
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

function zipDirectory(sourceDir, outZipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(archive.pointer()));
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

async function main() {
  const chromeDir = path.join(rootDir, 'dist', 'chrome');
  const firefoxDir = path.join(rootDir, 'dist', 'firefox');
  const chromeZip = path.join(rootDir, 'dist', 'preenche-sigeduc-chrome.zip');
  const firefoxZip = path.join(rootDir, 'dist', 'preenche-sigeduc-firefox.zip');

  if (!fs.existsSync(chromeDir) || !fs.existsSync(firefoxDir)) {
    throw new Error('Execute `npm run build` antes de `npm run package`.');
  }

  const chromeUncompressedKB = getDirSizeBytes(chromeDir) / 1024;
  const firefoxUncompressedKB = getDirSizeBytes(firefoxDir) / 1024;

  const chromeZipBytes = await zipDirectory(chromeDir, chromeZip);
  const firefoxZipBytes = await zipDirectory(firefoxDir, firefoxZip);

  console.log(`[package] dist/chrome:  ${chromeUncompressedKB.toFixed(1)} KB (zip: ${(chromeZipBytes / 1024).toFixed(1)} KB)`);
  console.log(`[package] dist/firefox: ${firefoxUncompressedKB.toFixed(1)} KB (zip: ${(firefoxZipBytes / 1024).toFixed(1)} KB)`);

  if (chromeUncompressedKB >= 1536 || firefoxUncompressedKB >= 1536) {
    throw new Error(`Tamanho descompactado excede SLA de 1536 KB (1.5 MB).`);
  }
}

await main();
