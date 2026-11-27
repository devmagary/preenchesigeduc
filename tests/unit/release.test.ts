import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { hasCwsCredentials, publishToChromeWebStore } from '../../scripts/cws-publish.mjs';
import { computeNextVersion } from '../../scripts/release.mjs';

const rootDir = path.resolve(__dirname, '../..');

describe('release script & manifest version sync', () => {
  it('calcula corretamente versões patch, minor, major e explícitas', () => {
    expect(computeNextVersion('1.0.0', 'patch')).toBe('1.0.1');
    expect(computeNextVersion('1.0.0', 'minor')).toBe('1.1.0');
    expect(computeNextVersion('1.0.0', 'major')).toBe('2.0.0');
    expect(computeNextVersion('1.0.0', 'v1.2.3')).toBe('1.2.3');
    expect(computeNextVersion('1.0.0', '2.5.0')).toBe('2.5.0');
    expect(() => computeNextVersion('1.0.0', 'invalida')).toThrow(/Especificação de versão inválida/);
  });

  it('mantém manifest.json e _locales/pt_BR/messages.json válidos e sincronizados em dist/chrome e dist/firefox', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    for (const target of ['chrome', 'firefox']) {
      const targetDir = path.join(rootDir, 'dist', target);
      const mPath = path.join(targetDir, 'manifest.json');
      if (fs.existsSync(mPath)) {
        const manifest = JSON.parse(fs.readFileSync(mPath, 'utf8'));
        expect(manifest.version).toBe(pkg.version);
        expect(manifest.default_locale).toBe('pt_BR');
        expect(manifest.name).toBe('__MSG_extName__');
        expect(manifest.description).toBe('__MSG_extDesc__');
        expect(manifest.action?.default_title).toBe('__MSG_extName__');

        const localePath = path.join(targetDir, '_locales', 'pt_BR', 'messages.json');
        expect(fs.existsSync(localePath)).toBe(true);
        const messages = JSON.parse(fs.readFileSync(localePath, 'utf8'));
        expect(messages.extName?.message).toBe('Preenche SIGEduc');
        expect(messages.extName?.message.length).toBeLessThanOrEqual(45);
        expect(messages.extDesc?.message).toContain('SIGEduc-BA');
        expect(messages.extDesc?.message.length).toBeLessThanOrEqual(132);
      }
    }
  });

  it('pula envio à Chrome Web Store com segurança quando secrets CWS_* não estão configurados', async () => {
    expect(hasCwsCredentials({})).toBe(false);
    const res = await publishToChromeWebStore({ env: {} });
    expect(res).toEqual({ skipped: true, reason: 'missing_credentials' });
  });

  it('executa fluxo OAuth2 + upload + publish da Chrome Web Store quando credenciais estão presentes', async () => {
    const tmpZip = path.join(os.tmpdir(), 'preenche-cws-test.zip');
    fs.writeFileSync(tmpZip, Buffer.from('PKTEST'));
    const calls: string[] = [];
    const fakeFetch = async (url: string) => {
      calls.push(url);
      if (url.includes('oauth2.googleapis.com')) {
        return new Response(JSON.stringify({ access_token: 'tok-123' }), { status: 200 });
      }
      if (url.includes('/upload/chromewebstore/')) {
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
          CWS_EXTENSION_ID: 'mdckmbhobjcoaamkcfloofpdmciidjjg',
        },
        fetchImpl: fakeFetch as typeof fetch,
      });
      expect(res.skipped).toBe(false);
      expect(calls).toHaveLength(3);
      expect(calls[1]).toContain('mdckmbhobjcoaamkcfloofpdmciidjjg');
      expect(calls[2]).toContain('/publish');
    } finally {
      fs.rmSync(tmpZip, { force: true });
    }
  });
});
