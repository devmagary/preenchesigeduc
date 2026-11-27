import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithRetry, sleepMs } from './store-http.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const EDGE_API_BASE = 'https://api.addons.microsoftedge.microsoft.com/v1';

export function hasEdgeCredentials(env = process.env) {
  return Boolean(
    env.EDGE_PRODUCT_ID?.trim() &&
      env.EDGE_CLIENT_ID?.trim() &&
      env.EDGE_API_KEY?.trim()
  );
}

export async function publishToEdgeAddons({
  zipPath = path.join(rootDir, 'dist', 'preenche-sigeduc-chrome.zip'),
  env = process.env,
  fetchImpl = globalThis.fetch,
  pollIntervalMs = 3000,
  maxPolls = 20,
  retryOptions = { maxRetries: 3, baseDelayMs: 500 },
  notes = 'Atualização automática publicada via GitHub Actions.',
} = {}) {
  if (!hasEdgeCredentials(env)) {
    console.log(
      '[edge] Secrets EDGE_PRODUCT_ID/EDGE_CLIENT_ID/EDGE_API_KEY não configurados; pulando publicação automática no Microsoft Edge Add-ons.'
    );
    return { skipped: true, reason: 'missing_credentials' };
  }

  if (!fs.existsSync(zipPath)) {
    throw new Error(`Pacote Edge/Chrome não encontrado em: ${zipPath}`);
  }

  const productId = env.EDGE_PRODUCT_ID.trim();
  const clientId = env.EDGE_CLIENT_ID.trim();
  const apiKey = env.EDGE_API_KEY.trim();
  const authHeaders = {
    Authorization: `ApiKey ${apiKey}`,
    'X-ClientID': clientId,
  };

  // 1. Enviar pacote .zip para rascunho na Edge Add-ons Publish API v1.1
  const zipBytes = fs.readFileSync(zipPath);
  const uploadUrl = `${EDGE_API_BASE}/products/${encodeURIComponent(productId)}/submissions/draft/package`;
  const uploadRes = await fetchWithRetry(
    fetchImpl,
    uploadUrl,
    {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/zip',
      },
      body: zipBytes,
    },
    retryOptions
  );

  if (uploadRes.status !== 202 && !uploadRes.ok) {
    const errText = await uploadRes.text().catch(() => '');
    throw new Error(`Falha no upload para o Edge Add-ons (${uploadRes.status}): ${errText}`);
  }

  const location = uploadRes.headers?.get?.('location') || uploadRes.headers?.get?.('Location') || '';
  const operationId = location.split('/').filter(Boolean).pop() || '';
  if (!operationId) {
    throw new Error('Upload para Edge Add-ons não retornou header Location com operationId.');
  }

  // 2. Aguardar conclusão do processamento do pacote
  const statusUrl = `${EDGE_API_BASE}/products/${encodeURIComponent(productId)}/submissions/draft/package/operations/${encodeURIComponent(operationId)}`;
  let uploadStatus = null;
  for (let i = 0; i < maxPolls; i++) {
    const statusRes = await fetchWithRetry(
      fetchImpl,
      statusUrl,
      { method: 'GET', headers: authHeaders },
      retryOptions
    );
    if (!statusRes.ok) {
      const errText = await statusRes.text().catch(() => '');
      throw new Error(`Falha ao consultar status do upload Edge (${statusRes.status}): ${errText}`);
    }
    uploadStatus = await statusRes.json().catch(() => ({}));
    if (uploadStatus.status === 'Succeeded') break;
    if (uploadStatus.status === 'Failed') {
      throw new Error(`Processamento do pacote Edge Add-ons falhou: ${JSON.stringify(uploadStatus)}`);
    }
    await sleepMs(pollIntervalMs);
  }
  if (!uploadStatus || uploadStatus.status !== 'Succeeded') {
    throw new Error(`Timeout aguardando validação do pacote no Edge Add-ons (operationId: ${operationId}).`);
  }

  // 3. Submeter publicação para revisão
  const publishUrl = `${EDGE_API_BASE}/products/${encodeURIComponent(productId)}/submissions`;
  const publishRes = await fetchWithRetry(
    fetchImpl,
    publishUrl,
    {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ notes }),
    },
    retryOptions
  );

  if (publishRes.status !== 202 && !publishRes.ok) {
    const errText = await publishRes.text().catch(() => '');
    throw new Error(`Falha ao submeter publicação no Edge Add-ons (${publishRes.status}): ${errText}`);
  }

  const publishOperation = publishRes.headers?.get?.('location') || '';
  console.log(`[edge] Pacote enviado e submetido para revisão no Microsoft Edge Add-ons (Product ID: ${productId}).`);
  return { skipped: false, operationId, uploadStatus, publishOperation };
}

const isEntrypoint =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntrypoint) {
  publishToEdgeAddons().catch((err) => {
    console.error('[edge] ERRO:', err.message);
    process.exitCode = 1;
  });
}
