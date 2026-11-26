import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ABOUT_SECTIONS,
  APP_NAME,
  APP_PORTAL_URL,
  APP_REPO_URL,
  getExtensionVersion,
} from '../../src/core/about';

describe('Seção Sobre / Aviso Legal e Privacidade (P2 #8)', () => {
  it('expoe os 3 avisos obrigatórios, links oficiais e nome da extensão', () => {
    expect(APP_NAME).toBe('Preenche SIGEduc');
    expect(APP_REPO_URL).toBe('https://github.com/devmagary/preenchesigeduc');
    expect(APP_PORTAL_URL).toBe('https://is.gd/sigeduc');
    expect(ABOUT_SECTIONS).toHaveLength(3);

    const combinedText = ABOUT_SECTIONS.map((s) => `${s.title} ${s.body}`).join(' ');
    expect(combinedText).toMatch(/SEC-BA/i);
    expect(combinedText).toMatch(/gratuitamente/i);
    expect(combinedText).toMatch(/100% local|localmente/i);
    expect(combinedText).toMatch(/memória RAM/i);
    expect(combinedText).toMatch(/responsabilidade exclusiva do docente/i);
  });

  it('retorna versão do manifest quando disponível e usa fallback caso ausente', () => {
    const g = globalThis as Record<string, unknown>;
    const prevChrome = g.chrome;
    try {
      g.chrome = { runtime: { getManifest: () => ({ version: '2.4.1' }) } };
      expect(getExtensionVersion('1.0.0')).toBe('2.4.1');

      delete g.chrome;
      expect(getExtensionVersion('1.0.0')).toBe('1.0.0');
    } finally {
      if (prevChrome === undefined) delete g.chrome;
      else g.chrome = prevChrome;
    }
  });

  it('popup.html inclui bloco expansível Sobre com marcador de versão e conteúdo', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../../src/popup/popup.html'), 'utf8');
    expect(html).toContain('id="popup-about-details"');
    expect(html).toContain('id="popup-version"');
    expect(html).toContain('id="popup-about-content"');
    expect(html).toContain('Sobre / Aviso Legal e Privacidade');
  });
});
