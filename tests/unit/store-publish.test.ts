import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAmoJwt, hasAmoCredentials, publishToFirefoxAmo } from '../../scripts/amo-publish.mjs';
import { publishToChromeWebStore } from '../../scripts/cws-publish.mjs';
import { hasEdgeCredentials, publishToEdgeAddons } from '../../scripts/edge-publish.mjs';
import { fetchWithRetry } from '../../scripts/store-http.mjs';

const rootDir = path.resolve(__dirname, '../..');

describe('Automação de publicação nas lojas & links oficiais (P1 #6 / P2 #10)', () => {
  it('fetchWithRetry retenta em 429 e 503 antes de retornar sucesso', async () => {
    let attempts = 0;
    const mockFetch = async () => {
      attempts++;
      if (attempts === 1) return new Response('rate limit', { status: 429, headers: { 'retry-after': '0' } });
      if (attempts === 2) return new Response('unavailable', { status: 503 });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    };

    const res = await fetchWithRetry(mockFetch as typeof fetch, 'https://example.test/api', {}, { maxRetries: 3, baseDelayMs: 1 });
    expect(res.status).toBe(200);
    expect(attempts).toBe(3);
  });

  it('publishToChromeWebStore recupera de erro transitório 503 com retry', async () => {
    const tmpZip = path.join(os.tmpdir(), 'preenche-cws-retry-test.zip');
    fs.writeFileSync(tmpZip, Buffer.from('PKTEST'));
    let uploadTries = 0;

    const fakeFetch = async (url: string) => {
      if (url.includes('oauth2.googleapis.com')) {
        return new Response(JSON.stringify({ access_token: 'tok-retry' }), { status: 200 });
      }
      if (url.includes('/upload/chromewebstore/')) {
        uploadTries++;
        if (uploadTries === 1) return new Response('temp error', { status: 503 });
        return new Response(JSON.stringify({ uploadState: 'SUCCESS' }), { status: 200 });
      }
      return new Response(JSON.stringify({ status: ['OK'] }), { status: 200 });
    };

    try {
      const res = await publishToChromeWebStore({
        zipPath: tmpZip,
        env: {
          CWS_CLIENT_ID: 'cid',
          CWS_CLIENT_SECRET: 'csec',
          CWS_REFRESH_TOKEN: 'rtok',
          CWS_EXTENSION_ID: 'fafdmobaohddjlphkfkhfhahlpeffeji',
        },
        fetchImpl: fakeFetch as typeof fetch,
        retryOptions: { maxRetries: 2, baseDelayMs: 1 },
      });
      expect(res.skipped).toBe(false);
      expect(uploadTries).toBe(2);
    } finally {
      fs.rmSync(tmpZip, { force: true });
    }
  });

  it('Microsoft Edge Add-ons: pula sem credenciais, executa upload + polling + submissão e falha se status=Failed', async () => {
    expect(hasEdgeCredentials({})).toBe(false);
    const skipped = await publishToEdgeAddons({ env: {} });
    expect(skipped).toEqual({ skipped: true, reason: 'missing_credentials' });

    const tmpZip = path.join(os.tmpdir(), 'preenche-edge-test.zip');
    fs.writeFileSync(tmpZip, Buffer.from('PKEDGE'));
    let pollStep = 0;
    const called: string[] = [];

    const okFetch = async (url: string) => {
      called.push(url);
      if (url.endsWith('/submissions/draft/package')) {
        return new Response('', {
          status: 202,
          headers: { Location: '/v1/products/prod-1/submissions/draft/package/operations/op-99' },
        });
      }
      if (url.includes('/operations/op-99')) {
        pollStep++;
        const status = pollStep === 1 ? 'InProgress' : 'Succeeded';
        return new Response(JSON.stringify({ status }), { status: 200 });
      }
      return new Response('', {
        status: 202,
        headers: { Location: '/v1/products/prod-1/submissions/operations/sub-1' },
      });
    };

    try {
      const res = await publishToEdgeAddons({
        zipPath: tmpZip,
        env: {
          EDGE_PRODUCT_ID: 'prod-1',
          EDGE_CLIENT_ID: 'client-1',
          EDGE_API_KEY: 'key-1',
        },
        fetchImpl: okFetch as typeof fetch,
        pollIntervalMs: 0,
        maxPolls: 5,
        retryOptions: { maxRetries: 1, baseDelayMs: 1 },
      });
      expect(res.skipped).toBe(false);
      expect(res.operationId).toBe('op-99');
      expect(called.some((u) => u.endsWith('/submissions'))).toBe(true);

      const failFetch = async (url: string) => {
        if (url.endsWith('/submissions/draft/package')) {
          return new Response('', { status: 202, headers: { Location: '/operations/op-bad' } });
        }
        return new Response(JSON.stringify({ status: 'Failed', message: 'Invalid zip' }), { status: 200 });
      };
      await expect(
        publishToEdgeAddons({
          zipPath: tmpZip,
          env: { EDGE_PRODUCT_ID: 'p', EDGE_CLIENT_ID: 'c', EDGE_API_KEY: 'k' },
          fetchImpl: failFetch as typeof fetch,
          pollIntervalMs: 0,
          retryOptions: { maxRetries: 0, baseDelayMs: 1 },
        })
      ).rejects.toThrow(/falhou/i);
    } finally {
      fs.rmSync(tmpZip, { force: true });
    }
  });

  it('Firefox AMO: gera JWT HS256 válido, pula sem credenciais e executa upload + validação + versão', async () => {
    expect(hasAmoCredentials({})).toBe(false);
    const skipped = await publishToFirefoxAmo({ env: {} });
    expect(skipped).toEqual({ skipped: true, reason: 'missing_credentials' });

    const token = createAmoJwt({ issuer: 'user:123', secret: 'my-secret', nowSec: 1700000000 });
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    const decodedPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    expect(decodedPayload.iss).toBe('user:123');
    expect(decodedPayload.exp).toBe(1700000300);
    const expectedSig = crypto
      .createHmac('sha256', 'my-secret')
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64url');
    expect(parts[2]).toBe(expectedSig);

    const tmpZip = path.join(os.tmpdir(), 'preenche-amo-test.zip');
    const tmpManifest = path.join(os.tmpdir(), 'preenche-amo-manifest.json');
    fs.writeFileSync(tmpZip, Buffer.from('PKAMO'));
    fs.writeFileSync(
      tmpManifest,
      JSON.stringify({ browser_specific_settings: { gecko: { id: 'preenche-sigeduc@local.dev' } } })
    );

    let pollCount = 0;
    const okFetch = async (url: string) => {
      if (url.endsWith('/addons/upload/')) {
        return new Response(JSON.stringify({ uuid: 'uuid-77', processed: false, valid: false }), { status: 201 });
      }
      if (url.includes('/addons/upload/uuid-77/')) {
        pollCount++;
        return new Response(
          JSON.stringify({
            uuid: 'uuid-77',
            processed: pollCount >= 2,
            valid: pollCount >= 2,
          }),
          { status: 200 }
        );
      }
      return new Response(JSON.stringify({ id: 555, version: '1.2.0' }), { status: 201 });
    };

    try {
      const res = await publishToFirefoxAmo({
        zipPath: tmpZip,
        manifestPath: tmpManifest,
        env: { AMO_JWT_ISSUER: 'user:123', AMO_JWT_SECRET: 'sec-123' },
        fetchImpl: okFetch as typeof fetch,
        pollIntervalMs: 0,
        maxPolls: 5,
        retryOptions: { maxRetries: 1, baseDelayMs: 1 },
      });
      expect(res.skipped).toBe(false);
      expect(res.addonId).toBe('preenche-sigeduc@local.dev');
      expect(res.uuid).toBe('uuid-77');
    } finally {
      fs.rmSync(tmpZip, { force: true });
      fs.rmSync(tmpManifest, { force: true });
    }
  });

  it('docs/index.html contém lojas oficiais Chrome/Edge, status Firefox Em breve, 4 cards e detector de navegador', () => {
    const html = fs.readFileSync(path.join(rootDir, 'docs', 'index.html'), 'utf8');
    expect(html).toContain(
      'https://chromewebstore.google.com/detail/preenche-sigeduc/fafdmobaohddjlphkfkhfhahlpeffeji?hl=pt-br'
    );
    expect(html).toContain(
      'https://microsoftedge.microsoft.com/addons/detail/gdcgkkoafnofbpalilnfnijlcfafnbfa'
    );
    expect(html).toContain('Em breve na loja do Firefox');
    expect(html).not.toContain('Em breve na loja do Chrome');
    expect(html).toContain('data-dl-card="chrome"');
    expect(html).toContain('data-dl-card="edge"');
    expect(html).toContain('data-dl-card="android"');
    expect(html).toContain('data-dl-card="firefox"');
    expect(html).toContain('detectBrowserTarget');
  });
});
