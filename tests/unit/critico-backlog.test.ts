// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildExportBundle, scrapeLancarFrequencia, scrapePortalDocente } from '../../src/sigeduc/scraper';

const rootDir = path.resolve(__dirname, '../..');

describe('critico backlog & historical minor fixes', () => {
  it('audita integridade estrutural de trabalho/critico_backlog.json e cobertura de testes', () => {
    const raw = fs.readFileSync(path.join(rootDir, 'trabalho', 'critico_backlog.json'), 'utf8');
    const backlog = JSON.parse(raw) as {
      schemaVersion: number;
      maxOpenMinorAllowed: number;
      items: Array<{
        id: string;
        round: number;
        severity: string;
        status: string;
        justification?: string;
        resolutionNote?: string;
        testFile?: string;
        testPattern?: string;
      }>;
    };

    expect(backlog.schemaVersion).toBe(1);
    expect(backlog.items.length).toBeGreaterThanOrEqual(10);

    const openCount = backlog.items.filter((i) => i.status === 'aberto' || i.status === 'agendado').length;
    expect(openCount).toBeLessThanOrEqual(backlog.maxOpenMinorAllowed);

    for (const item of backlog.items) {
      expect(item.id).toMatch(/^CR-\d{3}$/);
      expect(['resolvido', 'aberto', 'agendado', 'aceito_design']).toContain(item.status);
      if (item.status === 'resolvido') {
        expect(item.resolutionNote?.trim().length ?? 0).toBeGreaterThan(0);
        expect(item.testFile).toBeTruthy();
        expect(item.testPattern).toBeTruthy();
        const testAbs = path.join(rootDir, item.testFile!);
        expect(fs.existsSync(testAbs)).toBe(true);
        const testContent = fs.readFileSync(testAbs, 'utf8');
        expect(testContent.includes(item.testPattern!)).toBe(true);
      }
      if (item.status === 'aceito_design') {
        expect(item.justification?.trim().length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('CR-006: normaliza docente sem prefixo PROF. e exporta cabeçalho Série/Módulo', () => {
    const docenteHtml = fs.readFileSync(path.join(rootDir, 'trabalho', 'fixtures', 'docente.html'), 'utf8');
    const doc = new DOMParser().parseFromString(docenteHtml, 'text/html');
    const scraped = scrapePortalDocente(doc);

    expect(scraped.docente).toBe('DOCENTE MODELO');
    expect(scraped.docente.startsWith('PROF.')).toBe(false);

    const bundle = buildExportBundle(scraped);
    expect(bundle.headers).toContain('Série/Módulo');
    expect(bundle.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('CR-002: garante aba Modelo Frequência acentuada e concordância no bundle de exportação', () => {
    const freqHtml = fs.readFileSync(path.join(rootDir, 'trabalho', 'fixtures', 'lancar_frequencia.html'), 'utf8');
    const doc = new DOMParser().parseFromString(freqHtml, 'text/html');
    const scraped = scrapeLancarFrequencia(doc);
    const bundle = buildExportBundle(scraped);

    expect(bundle.sheets[0].name).toBe('Modelo Frequência');
  });
});
