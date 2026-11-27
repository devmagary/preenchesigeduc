import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithRetry } from './store-http.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export function hasCwsCredentials(env = process.env) {
  return Boolean(
    env.CWS_CLIENT_ID?.trim() &&
      env.CWS_CLIENT_SECRET?.trim() &&
      env.CWS_REFRESH_TOKEN?.trim() &&
      env.CWS_EXTENSION_ID?.trim()
  );
}

export async function publishToChromeWebStore({
  zipPath = path.join(rootDir, 'dist', 'preenche-sigeduc-chrome.zip'),
  env = process.env,
  fetchImpl = globalThis.fetch,
  retryOptions = { maxRetries: 3, baseDelayMs: 500 },
} = {}) {
  if (!hasCwsCredentials(env)) {
    console.log(
      '[cws] Secrets CWS_CLIENT_ID/CWS_CLIENT_SECRET/CWS_REFRESH_TOKEN/CWS_EXTENSION_ID não configurados; pulando publicação automática na Chrome Web Store.'
    );
    return { skipped: true, reason: 'missing_credentials' };
  }

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Pacote Chrome não encontrado em: ${zipPath}`);
  }

  const clientId = env.CWS_CLIENT_ID.trim();
  const clientSecret = env.CWS_CLIENT_SECRET.trim();
  const refreshToken = env.CWS_REFRESH_TOKEN.trim();
  const extensionId = env.CWS_EXTENSION_ID.trim();

  // 1. Obter Access Token OAuth2
  const tokenRes = await fetchWithRetry(
    fetchImpl,
    'https://oauth2.googleapis.com/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    },
    retryOptions
  );
  if (!tokenRes.ok) {
    throw new Error(`Falha ao obter token OAuth2 da Chrome Web Store (${tokenRes.status}).`);
  }
  const tokenData = await tokenRes.json();
  const accessToken = tokenData?.access_token;
  if (!accessToken) {
    throw new Error('Resposta OAuth2 da Chrome Web Store não retornou access_token.');
  }

  // 2. Enviar arquivo .zip para a Chrome Web Store
  const zipBytes = fs.readFileSync(zipPath);
  const uploadRes = await fetchWithRetry(
    fetchImpl,
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${encodeURIComponent(extensionId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
      },
      body: zipBytes,
    },
    retryOptions
  );
  const uploadJson = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || uploadJson.uploadState === 'FAILURE') {
    throw new Error(
      `Falha no upload para a Chrome Web Store (${uploadRes.status}): ${JSON.stringify(uploadJson)}`
    );
  }

  // 3. Submeter para revisão/publicação
  const publishRes = await fetchWithRetry(
    fetchImpl,
    `https://www.googleapis.com/chromewebstore/v1.1/items/${encodeURIComponent(extensionId)}/publish`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-goog-api-version': '2',
        'Content-Length': '0',
      },
    },
    retryOptions
  );
  const publishJson = await publishRes.json().catch(() => ({}));
  if (!publishRes.ok) {
    throw new Error(
      `Falha ao publicar na Chrome Web Store (${publishRes.status}): ${JSON.stringify(publishJson)}`
    );
  }

  console.log(`[cws] Pacote enviado e submetido para revisão na Chrome Web Store (ID: ${extensionId}).`);
  return { skipped: false, upload: uploadJson, publish: publishJson };
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntrypoint) {
  publishToChromeWebStore().catch((err) => {
    console.error('[cws] ERRO:', err.message);
    process.exitCode = 1;
  });
}
