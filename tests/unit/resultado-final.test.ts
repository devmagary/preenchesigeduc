// @vitest-environment jsdom
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  computeCetepTurmaStats,
  computeStudentNotaGeral,
  exportCetepXlsxBuffer,
} from '../../src/core/cetep';
import { scrapedNotasToCetepTurma } from '../../src/sigeduc/batch-extract';
import {
  buildExportBundle,
  pickUnitFromScrapedList,
  scrapeLancarNotas,
  scrapeLancarNotasAllUnits,
} from '../../src/sigeduc/scraper';

function loadNotasFixtureDoc(): Document {
  const fixturePath = path.resolve(__dirname, '../fixtures/lancar_notas_anual.html');
  const html = fs.readFileSync(fixturePath, 'utf8');
  return new DOMParser().parseFromString(html, 'text/html');
}

describe('Extração da aba Res. Final (P0 #2)', () => {
  it('scrapeLancarNotasAllUnits extrai colunas de input, span e notas das unidades regulares na aba Res. Final', () => {
    const doc = loadNotasFixtureDoc();
    const units = scrapeLancarNotasAllUnits(doc);

    expect(units.length).toBe(4);
    const resFinal = units.find((u) => u.isResultadoFinal);
    expect(resFinal).toBeDefined();
    expect(resFinal!.unidadeAtiva).toMatch(/Res\.?\s*Final/i);

    const colNames = resFinal!.atividades.map((a) => a.nome);
    expect(colNames).toEqual([
      '1ª Un.',
      '2ª Un.',
      '3ª Un.',
      'Média Anual',
      'Rec. Final',
      'Média Final',
      'Total de Faltas',
      '%Frequência Componente',
      'Res. Parcial Componente',
    ]);

    expect(resFinal!.alunos.length).toBe(45);

    // Aluno 0: aprovado direto (8.0 em 1ª Un., 8.0 MA, 8.0 MF, APROVADO)
    const st0 = resFinal!.alunos[0];
    expect(st0.notasAtividades['rf_unit_1']).toBe('8.0');
    expect(st0.notasAtividades['rf_media_anual']).toBe('8.0');
    expect(st0.notasAtividades['rf_media_final']).toBe('8.0');
    expect(st0.notasAtividades['rf_freq_pct']).toBe('95.0');
    expect(st0.notasAtividades['rf_res_parcial']).toBe('APROVADO');

    // Aluno 30: passou após Rec. Final (MA 4.0, Rec 6.5, MF 5.3, APROVADO)
    const st30 = resFinal!.alunos[30];
    expect(st30.notasAtividades['rf_unit_1']).toBe('4.0');
    expect(st30.notasAtividades['rf_media_anual']).toBe('4.0');
    expect(st30.notasAtividades['rf_rec_final']).toBe('6.5');
    expect(st30.notasAtividades['rf_media_final']).toBe('5.3');
    expect(st30.notasAtividades['rf_total_faltas']).toBe('4');
    expect(st30.notasAtividades['rf_res_parcial']).toBe('APROVADO');

    // Aluno 35: em recuperação sem MF ainda (MA 4.0, MF '', RECUPERAÇÃO)
    const st35 = resFinal!.alunos[35];
    expect(st35.notasAtividades['rf_media_anual']).toBe('4.0');
    expect(st35.notasAtividades['rf_media_final']).toBe('');
    expect(st35.notasAtividades['rf_res_parcial']).toBe('RECUPERAÇÃO');

    // Aluno 40: sem nota ('-')
    const st40 = resFinal!.alunos[40];
    expect(st40.notasAtividades['rf_media_final']).toBe('');
    expect(st40.notasAtividades['rf_res_parcial']).toBe('-');
  });

  it('scrapeLancarNotas + buildExportBundle suportam aba Res. Final selecionada sem "(Valor 10.0)"', () => {
    const doc = loadNotasFixtureDoc();
    doc.querySelectorAll('#formulario\\:tabViewId .ui-tabs-nav li').forEach((li) => {
      li.classList.remove('ui-tabs-selected', 'ui-state-active');
      if (/res\.?\s*final/i.test(li.textContent ?? '')) {
        li.classList.add('ui-tabs-selected', 'ui-state-active');
      }
    });
    doc.querySelectorAll('#formulario\\:tabViewId .ui-tabs-panel').forEach((p) => {
      p.classList.add('ui-tabs-hide');
    });
    doc.getElementById('formulario:resF')?.classList.remove('ui-tabs-hide');

    const scr = scrapeLancarNotas(doc);
    expect(scr.isResultadoFinal).toBe(true);
    const bundle = buildExportBundle(scr);
    expect(bundle.baseFileName).toBe('resultado_final_sigeduc');
    expect(bundle.sheets[0].name).toBe('Resultado Final');
    expect(bundle.headers).not.toContain('Média Anual (Valor 10.0)');
    expect(bundle.headers).toContain('Res. Parcial Componente');
    expect(bundle.rows[0][bundle.headers.indexOf('Res. Parcial Componente')]).toBe('APROVADO');
  });

  it('pickUnitFromScrapedList seleciona Res. Final quando preferred="final" e nunca a escolhe no modo "active"', () => {
    const doc = loadNotasFixtureDoc();
    const units = scrapeLancarNotasAllUnits(doc);

    const chosenFinal = pickUnitFromScrapedList(units, 'final', '3ª Unidade');
    expect(chosenFinal?.isResultadoFinal).toBe(true);

    const chosenActive = pickUnitFromScrapedList(units, 'active', '1ª Unidade');
    expect(chosenActive?.isResultadoFinal).not.toBe(true);
    expect(chosenActive?.unidadeAtiva).toBe('3ª Unidade');

    // Mesmo se todas as unidades regulares estiverem bloqueadas e sem notas, "active" não cai em Res. Final
    const lockedUnits = units.map((u) =>
      u.isResultadoFinal
        ? u
        : {
            ...u,
            atividades: u.atividades.map((a) => ({ ...a, disabled: true })),
            alunos: u.alunos.map((st) => ({
              ...st,
              notaUnidade: '',
              recUnidade: '',
              notasAtividades: {},
            })),
          }
    );
    const lockedActive = pickUnitFromScrapedList(lockedUnits, 'active', '1ª Unidade');
    expect(lockedActive?.isResultadoFinal).not.toBe(true);
    expect(lockedActive?.unidadeAtiva).toBe('3ª Unidade');

    // E mesmo se nenhuma unidade regular tiver atividades/notas e activeLabel for Res. Final, cai na 1ª Unidade
    const emptyRegularUnits = units.map((u) =>
      u.isResultadoFinal ? u : { ...u, atividades: [], alunos: [] }
    );
    const fallbackActive = pickUnitFromScrapedList(emptyRegularUnits, 'active', 'Res. Final');
    expect(fallbackActive?.isResultadoFinal).not.toBe(true);
    expect(fallbackActive?.unidadeAtiva).toBe('1ª Unidade');
  });

  it('CETEP gera aba RF sem Avaliação 1 (10.0) e calcula Nota Geral a partir de Média Final/Média Anual (sem SUM)', () => {
    const doc = loadNotasFixtureDoc();
    const units = scrapeLancarNotasAllUnits(doc);
    const resFinal = pickUnitFromScrapedList(units, 'final', '3ª Unidade')!;

    const cetepTurma = scrapedNotasToCetepTurma(
      resFinal,
      {
        idTurmaComponente: '900001',
        turma: 'TURMA-ANUAL-1A',
        ano: '2026',
        escola: 'CETEP RECÔNCAVO II',
        ofertaEnsino: 'TÉCNICO EM INFORMÁTICA-ENSINO MÉDIO INTEGRADO',
        serie: '1ª SÉRIE',
        periodicidade: 'Anual',
        componente: 'EDUCAÇÃO DIGITAL E MIDIÁTICA',
      },
      'DOCENTE TESTE'
    );

    expect(cetepTurma.isResultadoFinal).toBe(true);
    // Aluno 30: Média Final 5.3 (nunca soma das colunas ~110)
    expect(computeStudentNotaGeral(cetepTurma.alunos[30], cetepTurma.atividades)).toBe(5.3);
    // Aluno 35: Média Final vazia -> fallback para Média Anual 4.0
    expect(computeStudentNotaGeral(cetepTurma.alunos[35], cetepTurma.atividades)).toBe(4.0);
    // Aluno 40: sem média
    expect(computeStudentNotaGeral(cetepTurma.alunos[40], cetepTurma.atividades)).toBeNull();

    const stats = computeCetepTurmaStats(cetepTurma, 5.0);
    expect(stats.aprovados).toBe(35);
    expect(stats.recuperacao).toBe(5);
    expect(stats.semNota).toBe(5);

    const buf = exportCetepXlsxBuffer([cetepTurma], {
      mode: 'multi_sheet',
      minPassingGrade: 5.0,
    });
    const wb = XLSX.read(buf, { type: 'buffer' });
    expect(wb.SheetNames[1]).toContain('RF');

    const turmaWs = wb.Sheets[wb.SheetNames[1]];
    const rows = XLSX.utils.sheet_to_json<Array<string | number>>(turmaWs, { header: 1 });
    // Linhas da aba individual: [0]=Título, [1]=Subtítulo turma, [2]=Voltar ao Painel, [3]=Cabeçalho da tabela
    const headerRow = rows[3].map((v) => String(v));
    expect(headerRow).not.toContain('Avaliação 1 (10.0)');
    expect(headerRow).toContain('Média Anual');
    expect(headerRow).toContain('Rec. Final');
    expect(headerRow).toContain('Média Final');
    expect(headerRow).toContain('Total de Faltas');
    expect(headerRow).toContain('%Frequência Componente');
    expect(headerRow).toContain('Res. Parcial Componente');
    expect(headerRow).toContain('Nota Geral');

    // Verificar fórmula de Nota Geral na linha 5 (index 4 = primeiro aluno -> col M)
    const notaGeralColIdx = headerRow.indexOf('Nota Geral');
    const colLetter = XLSX.utils.encode_col(notaGeralColIdx);
    const formulaCell = turmaWs[`${colLetter}5`];
    expect(formulaCell?.f).toMatch(/^IF\(/);
    expect(formulaCell?.f).not.toContain('SUM(');

    // Aluno 30 (index 4 + 30 = 34): Rec 6.5, MF 5.3, Observações vazio
    const rowSt30 = rows[34];
    expect(rowSt30[headerRow.indexOf('Rec. Final')]).toBe(6.5);
    expect(rowSt30[headerRow.indexOf('Média Final')]).toBe(5.3);
    expect(rowSt30[headerRow.indexOf('Res. Parcial Componente')]).toBe('APROVADO');
    expect(rowSt30[notaGeralColIdx]).toBe(5.3);
    expect(rowSt30[headerRow.indexOf('Situação')]).toBe('Aprovado');
    expect(rowSt30[headerRow.indexOf('Observações')] ?? '').toBe('');

    // Aluno 35 (index 4 + 35 = 39): MF vazia, fallback para MA 4.0
    const rowSt35 = rows[39];
    expect(rowSt35[notaGeralColIdx]).toBe(4);
    expect(rowSt35[headerRow.indexOf('Situação')]).toBe('Recuperação');

    // Linha MÉDIA DA TURMA: coluna textual 'Res. Parcial Componente' deve ficar vazia
    const avgRow = rows[rows.length - 1];
    expect(avgRow[1]).toBe('MÉDIA DA TURMA');
    expect(avgRow[headerRow.indexOf('Res. Parcial Componente')] ?? '').toBe('');
  });
});
