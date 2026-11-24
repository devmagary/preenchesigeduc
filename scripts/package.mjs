import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';
import { buildCrx3Buffer, loadOrCreateCrxPrivateKey, verifyCrx3Buffer } from './crx3.mjs';

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
  const edgeCrx = path.join(rootDir, 'dist', 'preenche-sigeduc-edge-mobile.crx');
  const defaultPemPath = path.join(rootDir, '.keys', 'preenche-sigeduc.pem');

  if (!fs.existsSync(chromeDir) || !fs.existsSync(firefoxDir)) {
    throw new Error('Execute `npm run build` antes de `npm run package`.');
  }

  const chromeUncompressedKB = getDirSizeBytes(chromeDir) / 1024;
  const firefoxUncompressedKB = getDirSizeBytes(firefoxDir) / 1024;

  const chromeZipBytes = await zipDirectory(chromeDir, chromeZip);
  const firefoxZipBytes = await zipDirectory(firefoxDir, firefoxZip);

  const zipBuffer = fs.readFileSync(chromeZip);
  const { privateKey, source, created } = loadOrCreateCrxPrivateKey({ keyPath: defaultPemPath });
  const { crxBuffer, extensionId } = buildCrx3Buffer(zipBuffer, privateKey);
  const verified = verifyCrx3Buffer(crxBuffer);
  if (!verified.valid) {
    throw new Error(`Falha ao validar CRX3 gerado: ${verified.reason}`);
  }
  fs.writeFileSync(edgeCrx, crxBuffer);

  console.log(`[package] dist/chrome:  ${chromeUncompressedKB.toFixed(1)} KB (zip: ${(chromeZipBytes / 1024).toFixed(1)} KB)`);
  console.log(`[package] dist/firefox: ${firefoxUncompressedKB.toFixed(1)} KB (zip: ${(firefoxZipBytes / 1024).toFixed(1)} KB)`);
  console.log(
    `[package] dist/edge-crx: ${(crxBuffer.length / 1024).toFixed(1)} KB (id: ${extensionId}, chave: ${created ? 'nova .pem local' : source === 'env:CRX_PRIVATE_KEY_PEM' ? 'CRX_PRIVATE_KEY_PEM' : '.keys/preenche-sigeduc.pem'})`
  );

  if (chromeUncompressedKB >= 1536 || firefoxUncompressedKB >= 1536) {
    throw new Error(`Tamanho descompactado excede SLA de 1536 KB (1.5 MB).`);
  }
}

await main();
