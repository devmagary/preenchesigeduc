import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  computeCetepTurmaStats,
  exportCetepXlsxBuffer,
  parseTurmaIdentity,
  type CetepTurmaData,
} from '../../src/core/cetep';
import { parseWorkbookBuffer, selectBestWorkbookTarget } from '../../src/core/spreadsheet';
import { resolveTurmaUnitChoice } from '../../src/sigeduc/batch-extract';
import { pickUnitFromScrapedList, type ScrapedNotasScreen } from '../../src/sigeduc/scraper';

function buildSampleTurmas(): CetepTurmaData[] {
  return [
    {
      idTurmaComponente: '900001',
      escola: 'CETEP RECÔNCAVO II',
      docente: 'PROFESSOR TESTE',
      ano: '2026',
      unidade: '1ª Unidade',
      identity: parseTurmaIdentity({
        turma: 'TURMA-ANUAL-1A',
        ofertaEnsino: 'TÉCNICO EM INFORMÁTICA-ENSINO MÉDIO INTEGRADO',
        serie: '1ª SÉRIE',
        componente: 'EDUCAÇÃO DIGITAL E MIDIÁTICA',
        fullTurmaHeader: 'TÉCNICO EM INFORMÁTICA-ENSINO MÉDIO INTEGRADO - 1ª SÉRIE - TURMA-ANUAL-1A / VESPERTINO',
      }),
      atividades: [
        { idAvaliacao: '1', nome: 'Atividades em sala', valorMax: 3.0 },
        { idAvaliacao: '2', nome: 'Teste', valorMax: 3.0 },
        { idAvaliacao: '3', nome: 'Simulado', valorMax: 4.0 },
      ],
      alunos: [
        { numero: 1, nome: 'ANA CLARA FERREIRA', matricula: '202690010001', notas: { '1': 2.5, '2': 2.5, '3': 3.0 } },
        { numero: 2, nome: 'BRUNO HENRIQUE SOUZA', matricula: '202690010002', notas: { '1': 1.5, '2': 1.0, '3': 1.5 } },
        { numero: 3, nome: 'CARLA MENDES OLIVEIRA', matricula: '202690010003', notas: { '1': 0.0, '2': 0.0, '3': 0.0 } },
        { numero: 4, nome: 'DANIEL COSTA ALMEIDA', matricula: '202690010004', notas: { '1': null, '2': null, '3': null } },
      ],
    },
    {
      idTurmaComponente: '900002',
      escola: 'CETEP RECÔNCAVO II',
      docente: 'PROFESSOR TESTE',
      ano: '2026',
      unidade: '2ª Unidade',
      identity: parseTurmaIdentity({
        turma: 'ANACNOTM1A2',
        ofertaEnsino: 'TÉCNICO EM ANÁLISES CLÍNICAS-SUBSEQUENTE',
        serie: 'MÓDULO I',
        componente: 'INFORMATICA APLICADA',
      }),
      atividades: [
        { idAvaliacao: '91', nome: 'Prova Escrita', valorMax: 4.0 },
        { idAvaliacao: '92', nome: 'Atividade Prática', valorMax: 6.0 },
      ],
      alunos: [
        { numero: 1, nome: 'EDUARDA RIBEIRO SANTOS', matricula: '202690020001', notas: { '91': 3.5, '92': 4.5 } },
        { numero: 2, nome: 'FELIPE BARBOSA LIMA', matricula: '202690020002', notas: { '91': 2.0, '92': 3.0 } },
      ],
    },
  ];
}

describe('CETEP identity, stats and OOXML xlsx export', () => {
  it('identifica curso, modalidade (Ensino Médio ou Técnico) e turno corretamente', () => {
    const em = parseTurmaIdentity({
      turma: 'ADMVES1SA',
      ofertaEnsino: 'TÉCNICO EM ADMINISTRAÇÃO-ENSINO MÉDIO INTEGRADO',
      serie: '1ª SÉRIE',
      componente: 'EDUCAÇÃO DIGITAL E MIDIÁTICA',
    });
    expect(em.modalidade).toBe('Ensino Médio');
    expect(em.curso).toContain('Administração');
    expect(em.turno).toBe('Vespertino');

    const tec = parseTurmaIdentity({
      turma: 'ANACNOTM1A2',
      ofertaEnsino: 'TÉCNICO EM ANÁLISES CLÍNICAS-SUBSEQUENTE',
      serie: 'MÓDULO I',
      componente: 'INFORMÁTICA APLICADA',
    });
    expect(tec.modalidade).toBe('Técnico');
    expect(tec.curso).toContain('Análises Clínicas');
    expect(tec.turno).toBe('Noturno');
  });

  it('calcula estatísticas respeitando critério mínimo, 0.0 como Recuperação e vazio como Sem Nota', () => {
    const [t1] = buildSampleTurmas();
    const s5 = computeCetepTurmaStats(t1, 5.0);
    expect(s5.totalAlunos).toBe(4);
    expect(s5.aprovados).toBe(1); // 8.0
    expect(s5.recuperacao).toBe(2); // 4.0 e 0.0
    expect(s5.semNota).toBe(1);
    expect(s5.mediaGeral).toBe(4.0); // (8 + 4 + 0) / 3 = 4.0
    expect(s5.pctAprovacao).toBe(0.25);

    const s85 = computeCetepTurmaStats(t1, 8.5);
    expect(s85.aprovados).toBe(0);
    expect(s85.recuperacao).toBe(3);
  });

  it('exporta .xlsx multi-aba com estilos OOXML, formatação condicional, fórmulas reais e round-trip', () => {
    const turmas = buildSampleTurmas();
    const buf = exportCetepXlsxBuffer(turmas, {
      mode: 'multi_sheet',
      minPassingGrade: 5.0,
      generatedAt: new Date('2026-11-23T12:00:00Z'),
    });

    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames[0]).toBe('Painel Consolidado');
    expect(wb.SheetNames).toHaveLength(3);
    expect(wb.SheetNames[1]).toContain('1U');
    expect(wb.SheetNames[2]).toContain('2U');

    const panelRows = XLSX.utils.sheet_to_json(wb.Sheets['Painel Consolidado'], { header: 1 }) as unknown[][];
    const subtotalMedio = panelRows.find((r) => r[0] === 'SUBTOTAL — ENSINO MÉDIO');
    const subtotalTec = panelRows.find((r) => r[0] === 'SUBTOTAL — TÉCNICO');
    expect(subtotalMedio?.[1]).toBe('Ensino Médio');
    expect(subtotalMedio?.[2]).toBe('1ª Unidade');
    expect(subtotalMedio?.[3]).toBe(4);
    expect(subtotalTec?.[1]).toBe('Técnico');
    expect(subtotalTec?.[2]).toBe('2ª Unidade');
    expect(subtotalTec?.[3]).toBe(2);

    const totalGeralRow = panelRows.find((r) => r[0] === 'TOTAL GERAL');
    expect(totalGeralRow).toBeDefined();
    expect(totalGeralRow?.[3]).toBe(6); // 4 + 2 alunos (sem dupla contagem de subtotais)
    expect(totalGeralRow?.[5]).toBe(3); // 1 + 2 aprovados
    expect(totalGeralRow?.[6]).toBe(2); // 2 + 0 recuperação
    expect(totalGeralRow?.[7]).toBe(1); // 1 + 0 sem nota

    // Verificar fórmula real na célula de Nota Geral da 1ª turma
    const t1Sheet = wb.Sheets[wb.SheetNames[1]];
    expect(t1Sheet['G5']?.f).toContain('SUM(');
    expect(t1Sheet['G5']?.v).toBe(8);
    expect(t1Sheet['H5']?.f).toContain('IF(');
    expect(t1Sheet['H5']?.v).toBe('Aprovado');
    expect(t1Sheet['H7']?.v).toBe('Recuperação');
    expect(t1Sheet['H8']?.v).toBe('Sem Nota');

    const t1Rows = XLSX.utils.sheet_to_json(t1Sheet, { header: 1 }) as unknown[][];
    expect(t1Rows.some((r) => r[1] === 'MÉDIA DA TURMA')).toBe(true);

    // Conferir presença de styles.xml e conditionalFormatting no XML interno
    const zipStr = new TextDecoder('latin1').decode(buf);
    expect(zipStr).toContain('xl/styles.xml');
    expect(zipStr).toContain('<conditionalFormatting');
    expect(zipStr).toContain('<mergeCell');

    // Round-trip via P1.3 parser
    const parsedWb = parseWorkbookBuffer(buf.slice().buffer, 'cetep_multi.xlsx');
    const sel = selectBestWorkbookTarget(parsedWb, ['EDUARDA RIBEIRO SANTOS', 'FELIPE BARBOSA LIMA']);
    expect(sel.autoSelected).toBe(true);
    expect(sel.sheetIndex).toBe(2);
    expect(sel.matchedCount).toBe(2);
  });

  it('exporta .xlsx em aba única consolidada compatível com o detector multi-bloco P1.3', () => {
    const turmas = buildSampleTurmas();
    const buf = exportCetepXlsxBuffer(turmas, {
      mode: 'single_sheet',
      minPassingGrade: 5.0,
    });

    const wb = XLSX.read(buf, { type: 'array' });
    expect(wb.SheetNames).toEqual(['Consolidado CETEP']);

    const parsedWb = parseWorkbookBuffer(buf.slice().buffer, 'cetep_single.xlsx');
    expect(parsedWb.sheets).toHaveLength(1);
    expect(parsedWb.sheets[0].blocks).toHaveLength(2);
    const sel = selectBestWorkbookTarget(parsedWb, ['EDUARDA RIBEIRO SANTOS', 'FELIPE BARBOSA LIMA']);
    expect(sel.autoSelected).toBe(true);
    expect(sel.blockId).toBe(parsedWb.sheets[0].blocks[1].id);
    expect(sel.matchedCount).toBe(2);
  });

  it('resolve unidade por modalidade (Ensino Médio vs Técnico) e sobrescrita individual', () => {
    const opts = {
      unitMedio: '1' as const,
      unitTecnico: '2' as const,
      turmaUnitOverrides: { '900099': '3' as const },
      includeMatricula: false,
      mode: 'multi_sheet' as const,
      minPassingGrade: 5.0,
    };

    const medioTurma = {
      idTurmaComponente: '900001',
      turma: 'ADMVES1SA',
      ano: '2026',
      escola: 'ESCOLA',
      ofertaEnsino: 'TÉCNICO EM ADMINISTRAÇÃO-ENSINO MÉDIO INTEGRADO',
      serie: '1ª SÉRIE',
      periodicidade: 'Anual',
      componente: 'EDUCAÇÃO DIGITAL',
      qtdEstudantes: 35,
    };
    const tecTurma = {
      idTurmaComponente: '900002',
      turma: 'ANACNOTM1A2',
      ano: '2026',
      escola: 'ESCOLA',
      ofertaEnsino: 'TÉCNICO EM ANÁLISES CLÍNICAS-SUBSEQUENTE',
      serie: 'MÓDULO I',
      periodicidade: '2º Semestre',
      componente: 'INFORMÁTICA APLICADA',
      qtdEstudantes: 38,
    };
    const overrideTurma = { ...medioTurma, idTurmaComponente: '900099' };

    expect(resolveTurmaUnitChoice(medioTurma, '900001', opts)).toBe('1');
    expect(resolveTurmaUnitChoice(tecTurma, '900002', opts)).toBe('2');
    expect(resolveTurmaUnitChoice(overrideTurma, '900099', opts)).toBe('3');
  });

  it('prioriza a unidade ativa/mais recente aberta corretamente em pickUnitFromScrapedList sem travar na 1ª Unidade', () => {
    const makeUnit = (label: string, disabled: boolean, withGrades = true, empty = false): ScrapedNotasScreen => ({
      kind: 'lancar_notas',
      escola: 'CETEP',
      turma: 'TURMA-X',
      componente: 'INFORMÁTICA',
      totalAulas: '40',
      unidadeAtiva: label,
      unidadesDisponiveis: ['1ª Unidade', '2ª Unidade', '3ª Unidade'],
      atividades: empty ? [] : [{ idAvaliacao: label, nome: `Av ${label}`, valorMax: 10, disabled, colIndex: 0 }],
      alunos: [
        {
          index: 0,
          nome: 'ANA CLARA FERREIRA',
          notasAtividades: empty ? {} : { [label]: withGrades ? '8.0' : '' },
          inputIds: {},
          disabledMap: {},
          recUnidade: '',
          recInputId: null,
          recDisabled: true,
          notaUnidade: withGrades && !empty ? '8.0' : '',
        },
      ],
    });

    // Caso Semestral real: 1ª Unidade vem selecionada no HTML e aberta, mas 2ª Unidade também está aberta
    const semUnits = [makeUnit('1ª Unidade', false, true), makeUnit('2ª Unidade', false, true)];
    expect(pickUnitFromScrapedList(semUnits, 'active', '1ª Unidade')?.unidadeAtiva).toBe('2ª Unidade');
    expect(pickUnitFromScrapedList(semUnits, '1', '1ª Unidade')?.unidadeAtiva).toBe('1ª Unidade');
    expect(pickUnitFromScrapedList(semUnits, '2', '1ª Unidade')?.unidadeAtiva).toBe('2ª Unidade');

    // Caso Anual real: 1ª e 2ª fechadas, 3ª aberta
    const anualUnits = [makeUnit('1ª Unidade', true, true), makeUnit('2ª Unidade', true, true), makeUnit('3ª Unidade', false, false)];
    expect(pickUnitFromScrapedList(anualUnits, 'active', '1ª Unidade')?.unidadeAtiva).toBe('3ª Unidade');

    // Caso todas fechadas: pega a última unidade que possui atividades/notas (2ª, pois 3ª está vazia)
    const closedUnits = [makeUnit('1ª Unidade', true, true), makeUnit('2ª Unidade', true, true), makeUnit('3ª Unidade', true, false, true)];
    expect(pickUnitFromScrapedList(closedUnits, 'active', '1ª Unidade')?.unidadeAtiva).toBe('2ª Unidade');
  });

  it('gera hiperlinks bidirecionais válidos entre Painel Consolidado e abas/blocos de turma (multi-aba e aba única)', () => {
    const turmas = buildSampleTurmas();

    // Multi-aba (A6 = 1ª turma, A7 = SUBTOTAL ENSINO MÉDIO, A8 = 2ª turma)
    const multiBuf = exportCetepXlsxBuffer(turmas, { mode: 'multi_sheet', minPassingGrade: 5.0 });
    const multiWb = XLSX.read(multiBuf, { type: 'array' });
    const panelWs = multiWb.Sheets['Painel Consolidado'];
    expect(panelWs['A6']?.l?.Target).toBe(`#'${multiWb.SheetNames[1]}'!A1`);
    expect(panelWs['A8']?.l?.Target).toBe(`#'${multiWb.SheetNames[2]}'!A1`);

    for (const tabName of [multiWb.SheetNames[1], multiWb.SheetNames[2]]) {
      const ws = multiWb.Sheets[tabName];
      expect(ws['A3']?.v).toBe('← Voltar ao Painel');
      expect(ws['A3']?.l?.Target).toBe("#'Painel Consolidado'!A1");
    }

    // Sanitização de caracteres especiais (incluindo apóstrofo/barra) no nome da aba e no link
    const quotedTurma = {
      ...turmas[0],
      identity: {
        ...turmas[0].identity,
        sheetTabBase: "D'AVILA/1A",
      },
    };
    const quotedWb = XLSX.read(exportCetepXlsxBuffer([quotedTurma], { mode: 'multi_sheet', minPassingGrade: 5.0 }), { type: 'array' });
    const quotedTab = quotedWb.SheetNames[1];
    expect(quotedTab).toBe('D AVILA 1A 1U');
    expect(quotedWb.Sheets['Painel Consolidado']['A6']?.l?.Target).toBe(`#'${quotedTab}'!A1`);

    // Aba única consolidada (A6 = 1ª turma, A7 = SUBTOTAL, A8 = 2ª turma)
    const singleBuf = exportCetepXlsxBuffer(turmas, { mode: 'single_sheet', minPassingGrade: 5.0 });
    const singleWb = XLSX.read(singleBuf, { type: 'array' });
    const singleWs = singleWb.Sheets['Consolidado CETEP'];
    const link1 = singleWs['A6']?.l?.Target ?? '';
    const link2 = singleWs['A8']?.l?.Target ?? '';
    expect(link1).toMatch(/^#'Consolidado CETEP'!A\d+$/);
    expect(link2).toMatch(/^#'Consolidado CETEP'!A\d+$/);
    const block1Row = Number(link1.split('!A')[1]);
    expect(String(singleWs[`A${block1Row}`]?.v ?? '')).toContain('TURMA-ANUAL-1A');

    const backCells = Object.entries(singleWs).filter(
      ([ref, cell]) => /^[A-Z]+\d+$/.test(ref) && (cell as XLSX.CellObject)?.v === '↑ Voltar ao Painel'
    );
    expect(backCells).toHaveLength(2);
    for (const [, cell] of backCells) {
      expect((cell as XLSX.CellObject).l?.Target).toBe("#'Consolidado CETEP'!A4");
    }
  });
});
