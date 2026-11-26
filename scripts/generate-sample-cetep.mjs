import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportCetepXlsxBuffer, parseTurmaIdentity } from '../src/core/cetep.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outPath = path.join(rootDir, 'docs', 'amostra-cetep.xlsx');

const ESCOLA = 'CETEP EXEMPLO — REDE ESTADUAL BA';
const DOCENTE = 'DOCENTE EXEMPLO';
const ANO = '2026';

const atividadesUnidade3 = [
  { idAvaliacao: 'av1', nome: 'Atividade', valorMax: 3.0, colType: 'grade' },
  { idAvaliacao: 'av2', nome: 'Feira', valorMax: 3.0, colType: 'grade' },
  { idAvaliacao: 'av3', nome: 'Simulado', valorMax: 4.0, colType: 'grade' },
];

const atividadesResultadoFinal = [
  { idAvaliacao: 'rf_u1', nome: '1ª Un.', valorMax: 10.0, colType: 'grade' },
  { idAvaliacao: 'rf_u2', nome: '2ª Un.', valorMax: 10.0, colType: 'grade' },
  { idAvaliacao: 'rf_u3', nome: '3ª Un.', valorMax: 10.0, colType: 'grade' },
  { idAvaliacao: 'rf_media_anual', nome: 'Média Anual', valorMax: 10.0, colType: 'grade' },
  { idAvaliacao: 'rf_rec_final', nome: 'Rec. Final', valorMax: 10.0, colType: 'grade' },
  { idAvaliacao: 'rf_media_final', nome: 'Média Final', valorMax: 10.0, colType: 'grade' },
  { idAvaliacao: 'rf_freq_pct', nome: '%Frequência Componente', valorMax: 100, colType: 'percent' },
  { idAvaliacao: 'rf_res_parcial', nome: 'Res. Parcial Componente', valorMax: 10.0, colType: 'text' },
];

const turmas = [
  {
    idTurmaComponente: 'DEMO_ADM_1SA',
    escola: ESCOLA,
    docente: DOCENTE,
    ano: ANO,
    unidade: '3ª Unidade',
    identity: parseTurmaIdentity({
      ofertaEnsino: 'ENSINO MEDIO INTEGRADO TECNICO EM ADMINISTRACAO',
      serie: '1A SERIE',
      turma: 'ADMVES1SA',
      componente: 'EDUCACAO DIGITAL E MIDIATICA',
      fullTurmaHeader: 'ENSINO MEDIO INTEGRADO TECNICO EM ADMINISTRACAO - 1A SERIE - ADMVES1SA / VESPERTINO',
    }),
    atividades: atividadesUnidade3,
    alunos: [
      { numero: 1, nome: 'ALINE BARBOSA FICTICIA', matricula: '202600101', notas: { av1: 2.5, av2: 3.0, av3: 3.0 } },
      { numero: 2, nome: 'BRUNO CARVALHO DEMO', matricula: '202600102', notas: { av1: 2.0, av2: 2.5, av3: 2.0 } },
      { numero: 3, nome: 'CAMILA DIAS EXEMPLO', matricula: '202600103', notas: { av1: 1.5, av2: 2.0, av3: 1.0 } },
      { numero: 4, nome: 'DIEGO FERREIRA TESTE', matricula: '202600104', notas: { av1: 0.0, av2: 2.5, av3: 1.5 }, observacoes: 'Nota 0,0 na Atividade' },
      { numero: 5, nome: 'EDUARDA GOMES MODELO', matricula: '202600105', notas: { av1: 3.0, av2: 3.0, av3: 3.5 } },
      { numero: 6, nome: 'FELIPE LIMA SIMULADO', matricula: '202600106', notas: { av1: 2.5, av2: 2.5, av3: null }, observacoes: 'Não realização no Simulado' },
      { numero: 7, nome: 'GABRIELA MORAES PADRAO', matricula: '202600107', notas: { av1: null, av2: null, av3: null }, observacoes: 'Sem lançamentos' },
      { numero: 8, nome: 'HENRIQUE NUNES AMOSTRA', matricula: '202600108', notas: { av1: 2.0, av2: 1.5, av3: 2.0 } },
    ],
  },
  {
    idTurmaComponente: 'DEMO_AGRP_1SA',
    escola: ESCOLA,
    docente: DOCENTE,
    ano: ANO,
    unidade: '3ª Unidade',
    identity: parseTurmaIdentity({
      ofertaEnsino: 'ENSINO MEDIO INTEGRADO TECNICO EM AGROPECUARIA',
      serie: '1A SERIE',
      turma: 'AGRPMAT1SA',
      componente: 'EDUCACAO DIGITAL E MIDIATICA',
      fullTurmaHeader: 'ENSINO MEDIO INTEGRADO TECNICO EM AGROPECUARIA - 1A SERIE - AGRPMAT1SA / MATUTINO',
    }),
    atividades: atividadesUnidade3,
    alunos: [
      { numero: 1, nome: 'ISABELA OLIVEIRA FICTICIA', matricula: '202600201', notas: { av1: 2.5, av2: 2.8, av3: 3.2 } },
      { numero: 2, nome: 'JOAO PEREIRA DEMO', matricula: '202600202', notas: { av1: 2.0, av2: 2.0, av3: 1.5 } },
      { numero: 3, nome: 'KARINA RIBEIRO EXEMPLO', matricula: '202600203', notas: { av1: 1.5, av2: 1.0, av3: 1.5 } },
      { numero: 4, nome: 'LUCAS SANTANA TESTE', matricula: '202600204', notas: { av1: 3.0, av2: 2.5, av3: 2.5 } },
      { numero: 5, nome: 'MARIANA TEIXEIRA MODELO', matricula: '202600205', notas: { av1: null, av2: null, av3: null } },
      { numero: 6, nome: 'NICOLAS VIEIRA SIMULADO', matricula: '202600206', notas: { av1: 2.2, av2: 2.5, av3: 1.8 } },
    ],
  },
  {
    idTurmaComponente: 'DEMO_INF_M1A',
    escola: ESCOLA,
    docente: DOCENTE,
    ano: ANO,
    unidade: 'Res. Final',
    isResultadoFinal: true,
    identity: parseTurmaIdentity({
      ofertaEnsino: 'TECNICO SUBSEQUENTE EM INFORMATICA',
      serie: 'MODULO I',
      turma: 'INFNOTM1A2',
      componente: 'INFORMATICA APLICADA',
      fullTurmaHeader: 'TECNICO SUBSEQUENTE EM INFORMATICA - MODULO I - INFNOTM1A2 / NOTURNO',
    }),
    atividades: atividadesResultadoFinal,
    alunos: [
      {
        numero: 1,
        nome: 'OTAVIO ALMEIDA FICTICIO',
        matricula: '202600301',
        notas: { rf_u1: 7.5, rf_u2: 8.0, rf_u3: 7.0, rf_media_anual: 7.5, rf_rec_final: null, rf_media_final: 7.5, rf_freq_pct: 94.0 },
        textValues: { rf_res_parcial: 'Aprovado' },
      },
      {
        numero: 2,
        nome: 'PATRICIA BORGES DEMO',
        matricula: '202600302',
        notas: { rf_u1: 4.5, rf_u2: 4.0, rf_u3: 5.0, rf_media_anual: 4.5, rf_rec_final: 6.0, rf_media_final: 5.3, rf_freq_pct: 88.5 },
        textValues: { rf_res_parcial: 'Aprovado Rec.' },
      },
      {
        numero: 3,
        nome: 'RAFAEL COSTA EXEMPLO',
        matricula: '202600303',
        notas: { rf_u1: 3.5, rf_u2: 4.0, rf_u3: 3.0, rf_media_anual: 3.5, rf_rec_final: 4.2, rf_media_final: 3.9, rf_freq_pct: 82.0 },
        textValues: { rf_res_parcial: 'Reprovado' },
      },
      {
        numero: 4,
        nome: 'SOFIA DUARTE TESTE',
        matricula: '202600304',
        notas: { rf_u1: 8.5, rf_u2: 9.0, rf_u3: 8.0, rf_media_anual: 8.5, rf_rec_final: null, rf_media_final: 8.5, rf_freq_pct: 98.0 },
        textValues: { rf_res_parcial: 'Aprovado' },
      },
      {
        numero: 5,
        nome: 'THIAGO ESTEVES MODELO',
        matricula: '202600305',
        notas: { rf_u1: 5.0, rf_u2: 5.5, rf_u3: 6.0, rf_media_anual: 5.5, rf_rec_final: null, rf_media_final: 5.5, rf_freq_pct: 91.0 },
        textValues: { rf_res_parcial: 'Aprovado' },
      },
      {
        numero: 6,
        nome: 'VANESSA FARIAS SIMULADA',
        matricula: '202600306',
        notas: { rf_u1: null, rf_u2: null, rf_u3: null, rf_media_anual: null, rf_rec_final: null, rf_media_final: null, rf_freq_pct: 12.0 },
        textValues: { rf_res_parcial: 'Sem Nota' },
        observacoes: 'Evadida / sem avaliação',
      },
    ],
  },
];

const buffer = exportCetepXlsxBuffer(turmas, {
  mode: 'multi_sheet',
  minPassingGrade: 5.0,
  generatedAt: new Date('2026-11-26T12:00:00-03:00'),
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buffer);
console.log(`[sample-cetep] Gerado ${outPath} (${(buffer.length / 1024).toFixed(1)} KB, ${turmas.length} turmas)`);
