import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithRetry, sleepMs } from './store-http.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const AMO_API_BASE = 'https://addons.mozilla.org/api/v5';

export function hasAmoCredentials(env = process.env) {
  return Boolean(env.AMO_JWT_ISSUER?.trim() && env.AMO_JWT_SECRET?.trim());
}

function base64UrlEncode(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function createAmoJwt({ issuer, secret, nowSec = Math.floor(Date.now() / 1000) }) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: issuer,
      jti: crypto.randomBytes(12).toString('hex'),
      iat: nowSec,
      exp: nowSec + 300,
    })
  );
  const data = `${header}.${payload}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${data}.${sig}`;
}

function resolveFirefoxAddonId(env, manifestPath) {
  if (env.AMO_ADDON_ID?.trim()) return env.AMO_ADDON_ID.trim();
  if (manifestPath && fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const geckoId = manifest?.browser_specific_settings?.gecko?.id;
    if (typeof geckoId === 'string' && geckoId.trim()) return geckoId.trim();
  }
  return '';
}

export async function publishToFirefoxAmo({
  zipPath = path.join(rootDir, 'dist', 'preenche-sigeduc-firefox.zip'),
  manifestPath = path.join(rootDir, 'dist', 'firefox', 'manifest.json'),
  env = process.env,
  fetchImpl = globalThis.fetch,
  pollIntervalMs = 3000,
  maxPolls = 25,
  retryOptions = { maxRetries: 3, baseDelayMs: 500 },
  channel = 'listed',
} = {}) {
  if (!hasAmoCredentials(env)) {
    console.log(
      '[amo] Secrets AMO_JWT_ISSUER/AMO_JWT_SECRET não configurados; pulando publicação automática no Firefox Add-ons (AMO).'
    );
    return { skipped: true, reason: 'missing_credentials' };
  }

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Pacote Firefox não encontrado em: ${zipPath}`);
  }

  const addonId = resolveFirefoxAddonId(env, manifestPath);
  if (!addonId) {
    throw new Error('AMO_ADDON_ID não informado e gecko.id ausente em dist/firefox/manifest.json.');
  }

  const issuer = env.AMO_JWT_ISSUER.trim();
  const secret = env.AMO_JWT_SECRET.trim();
  const makeAuthHeader = () => ({ Authorization: `JWT ${createAmoJwt({ issuer, secret })}` });

  // 1. Enviar pacote .zip para AMO API v5
  const zipBytes = fs.readFileSync(zipPath);
  const form = new FormData();
  form.append('upload', new Blob([zipBytes], { type: 'application/zip' }), path.basename(zipPath));
  form.append('channel', channel);

  const uploadRes = await fetchWithRetry(
    fetchImpl,
    `${AMO_API_BASE}/addons/upload/`,
    {
      method: 'POST',
      headers: makeAuthHeader(),
      body: form,
    },
    retryOptions
  );
  const uploadJson = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || !uploadJson.uuid) {
    throw new Error(`Falha no upload para o Firefox AMO (${uploadRes.status}): ${JSON.stringify(uploadJson)}`);
  }

  // 2. Aguardar validação automática do pacote pela Mozilla
  const uuid = uploadJson.uuid;
  let detail = uploadJson;
  for (let i = 0; i < maxPolls; i++) {
    if (detail.processed) break;
    await sleepMs(pollIntervalMs);
    const pollRes = await fetchWithRetry(
      fetchImpl,
      `${AMO_API_BASE}/addons/upload/${encodeURIComponent(uuid)}/`,
      {
        method: 'GET',
        headers: makeAuthHeader(),
      },
      retryOptions
    );
    detail = await pollRes.json().catch(() => ({}));
    if (!pollRes.ok) {
      throw new Error(`Falha ao consultar validação AMO (${pollRes.status}): ${JSON.stringify(detail)}`);
    }
  }
  if (!detail.processed) {
    throw new Error(`Timeout aguardando validação automática no Firefox AMO (uuid: ${uuid}).`);
  }
  if (!detail.valid) {
    throw new Error(`Validação do pacote rejeitada pelo Firefox AMO: ${JSON.stringify(detail.validation ?? detail)}`);
  }

  // 3. Criar nova versão no AMO vinculada ao upload validado
  const versionRes = await fetchWithRetry(
    fetchImpl,
    `${AMO_API_BASE}/addons/addon/${encodeURIComponent(addonId)}/versions/`,
    {
      method: 'POST',
      headers: {
        ...makeAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ upload: uuid }),
    },
    retryOptions
  );
  const versionJson = await versionRes.json().catch(() => ({}));
  if (!versionRes.ok) {
    throw new Error(`Falha ao criar nova versão no Firefox AMO (${versionRes.status}): ${JSON.stringify(versionJson)}`);
  }

  console.log(`[amo] Nova versão enviada para revisão no Firefox Add-ons (ID: ${addonId}, upload: ${uuid}).`);
  return { skipped: false, addonId, uuid, version: versionJson };
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntrypoint) {
  publishToFirefoxAmo().catch((err) => {
    console.error('[amo] ERRO:', err.message);
    process.exitCode = 1;
  });
}
