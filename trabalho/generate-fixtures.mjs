import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, 'fixtures');
fs.mkdirSync(fixturesDir, { recursive: true });

// 45 estudantes 100% fictícios (incluindo acentos, homônimo controlado opcional e 1 ícone PCD \uF193)
export const FICTIONAL_STUDENTS = [
  { matricula: '202690010001', nome: 'ANA CLARA FERREIRA', pcd: false },
  { matricula: '202690010002', nome: 'BRUNO HENRIQUE SOUZA', pcd: false },
  { matricula: '202690010003', nome: 'CARLA MENDES OLIVEIRA', pcd: false },
  { matricula: '202690010004', nome: 'DANIEL COSTA ALMEIDA', pcd: false },
  { matricula: '202690010005', nome: 'EDUARDA RIBEIRO SANTOS', pcd: false },
  { matricula: '202690010006', nome: 'FELIPE BARBOSA LIMA', pcd: false },
  { matricula: '202690010007', nome: 'GABRIELA NASCIMENTO ROCHA', pcd: true },
  { matricula: '202690010008', nome: 'HEITOR CARVALHO DIAS', pcd: false },
  { matricula: '202690010009', nome: 'ISABELA MARTINS PEREIRA', pcd: false },
  { matricula: '202690010010', nome: 'JOÃO PEDRO GOMES', pcd: false },
  { matricula: '202690010011', nome: 'KAMILA TEIXEIRA CARDOSO', pcd: false },
  { matricula: '202690010012', nome: 'LUCAS ARAÚJO VIEIRA', pcd: false },
  { matricula: '202690010013', nome: 'MARIANA CORREIA FERNANDES', pcd: false },
  { matricula: '202690010014', nome: 'NATHÁLIA MOREIRA CASTRO', pcd: false },
  { matricula: '202690010015', nome: 'OTÁVIO NOGUEIRA PINTO', pcd: false },
  { matricula: '202690010016', nome: 'PAULA CRISTINA MONTEIRO', pcd: false },
  { matricula: '202690010017', nome: 'RAFAEL BORGES CAMPOS', pcd: false },
  { matricula: '202690010018', nome: 'SOFIA CAVALCANTE RAMOS', pcd: false },
  { matricula: '202690010019', nome: 'THIAGO FREITAS DUARTE', pcd: false },
  { matricula: '202690010020', nome: 'VITÓRIA MOURA REZENDE', pcd: false },
  { matricula: '202690010021', nome: 'ALICE BATISTA MACHADO', pcd: false },
  { matricula: '202690010022', nome: 'BERNARDO XAVIER CUNHA', pcd: false },
  { matricula: '202690010023', nome: 'CAMILA FARIAS BARRETO', pcd: false },
  { matricula: '202690010024', nome: 'DAVI LOPES MAGALHÃES', pcd: false },
  { matricula: '202690010025', nome: 'ELENA PIRES TAVARES', pcd: false },
  { matricula: '202690010026', nome: 'FÁBIO SILVEIRA AGUIAR', pcd: false },
  { matricula: '202690010027', nome: 'GIOVANNA MELO ANDRADE', pcd: false },
  { matricula: '202690010028', nome: 'HUGO FONTES QUEIROZ', pcd: false },
  { matricula: '202690010029', nome: 'IGOR SAMPAIO LACERDA', pcd: false },
  { matricula: '202690010030', nome: 'JÚLIA BEZERRA NEVES', pcd: false },
  { matricula: '202690010031', nome: 'KAUÃ MIRANDA SALES', pcd: false },
  { matricula: '202690010032', nome: 'LARISSA BRAGA TORRES', pcd: false },
  { matricula: '202690010033', nome: 'MATEUS GUIMARÃES COUTO', pcd: false },
  { matricula: '202690010034', nome: 'NICOLE VALENTE PEIXOTO', pcd: false },
  { matricula: '202690010035', nome: 'PEDRO HENRIQUE AMARAL', pcd: false },
  { matricula: '202690010036', nome: 'REBECA PORTO ASSIS', pcd: false },
  { matricula: '202690010037', nome: 'SAMUEL VASCONCELOS DINIZ', pcd: false },
  { matricula: '202690010038', nome: 'TAINÁ CORDEIRO BASTOS', pcd: false },
  { matricula: '202690010039', nome: 'VINÍCIUS CHAVES MEDEIROS', pcd: false },
  { matricula: '202690010040', nome: 'YASMIN NOBREGA FALCÃO', pcd: false },
  { matricula: '202690010041', nome: 'ARTHUR SIQUEIRA PAIXÃO', pcd: false },
  { matricula: '202690010042', nome: 'BEATRIZ FONSECA COELHO', pcd: false },
  { matricula: '202690010043', nome: 'CAIO REIS MARINHO', pcd: false },
  { matricula: '202690010044', nome: 'DÉBORA ANTUNES LEITE', pcd: false },
  { matricula: '202690010045', nome: 'ENZO FIGUEIREDO SALLES', pcd: false },
];

const docenteHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>SIGEduc - Portal Docente (Fixture)</title>
  <style>
    body { font-family: Verdana, sans-serif; font-size: 12px; margin: 16px; background: #f3f5f8; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background: #e2e8f0; }
  </style>
</head>
<body>
  <div id="perfil-docente">
    <p class="info-docente">PROF. DOCENTE MODELO</p>
  </div>
  <div id="turmas-portal">
    <h4>Minhas Turmas:</h4>
    <form id="formTurmas" method="post" action="/sigeduc/portais/docente/docente.jsf">
      <input type="hidden" name="DOUBLE_CHECK_TOKEN" value="mock-token-portal" />
      <input type="hidden" name="javax.faces.ViewState" value="j_id1" />
      <table id="formTurmas:turmasProfessorTable">
        <caption><strong>Turmas Regulares</strong></caption>
        <thead>
          <tr>
            <th>Turma</th><th>Ano</th><th>Escola</th><th>Oferta de Ensino</th>
            <th>Ano/Série</th><th>Periodicidade</th><th>Componente</th><th>Qtd. de Estudantes</th>
            <th></th><th></th><th></th>
          </tr>
        </thead>
        <tbody>
          <tr class="linhaPar">
            <td>TURMA-ANUAL-1A</td><td>2026</td><td>ESCOLA MODELO ESTADUAL</td>
            <td>TÉCNICO EM INFORMÁTICA-ENSINO MÉDIO INTEGRADO</td><td>1ª SÉRIE</td><td>Anual</td>
            <td>EDUCAÇÃO DIGITAL E MIDIÁTICA</td><td>45</td>
            <td><a href="/sigeduc/diario_classe/lancar_notas/form_estudantes_notas_avaliacoes_unidade.jsf" onclick="/* 'idTurmaComponente':'900001' */ return true;">Lançar Resultados</a></td>
            <td><a href="/sigeduc/diario_classe/frequencia_aluno/form.jsf" onclick="/* 'idTurmaComponente':'900001' */ return true;">Lançar Frequência</a></td>
            <td><a href="/sigeduc/ensino/grupo_avaliacao_unidade/lista.jsf" onclick="/* 'idTurmaComponente':'900001' */ return true;">Avaliações</a></td>
          </tr>
          <tr class="linhaImpar">
            <td>TURMA-SEM-M1</td><td>2026</td><td>ESCOLA MODELO ESTADUAL</td>
            <td>TÉCNICO EM ADMINISTRAÇÃO-SUBSEQUENTE</td><td>MÓDULO I</td><td>2º Semestre</td>
            <td>INFORMÁTICA APLICADA</td><td>45</td>
            <td><a href="/sigeduc/diario_classe/lancar_notas/form_estudantes_notas_avaliacoes_unidade.jsf?tipo=semestral" onclick="/* 'idTurmaComponente':'900002' */ return true;">Lançar Resultados</a></td>
            <td><a href="/sigeduc/diario_classe/frequencia_aluno/form.jsf" onclick="/* 'idTurmaComponente':'900002' */ return true;">Lançar Frequência</a></td>
            <td><a href="/sigeduc/ensino/grupo_avaliacao_unidade/lista.jsf" onclick="/* 'idTurmaComponente':'900002' */ return true;">Avaliações</a></td>
          </tr>
        </tbody>
      </table>
    </form>
  </div>
</body>
</html>`;

function buildNotasHtml({ semestral = false } = {}) {
  const atividadesU1 = semestral
    ? [
        { id: '9101', nome: 'Prova Escrita', valor: 4.0, disabled: false },
        { id: '9102', nome: 'Atividade 1', valor: 3.0, disabled: false },
        { id: '9103', nome: 'Atividade 2', valor: 3.0, disabled: false },
      ]
    : [
        { id: '7101', nome: 'Atividades em sala', valor: 3.0, disabled: true },
        { id: '7102', nome: 'Teste', valor: 3.0, disabled: true },
        { id: '7103', nome: 'Simulado', valor: 4.0, disabled: true },
      ];

  const atividadesU3 = [
    { id: '8001', nome: 'Participação', valor: 2.0, disabled: false },
    { id: '8002', nome: 'Atividade Prática', valor: 3.0, disabled: false },
    { id: '8003', nome: 'Seminário', valor: 2.0, disabled: false },
    { id: '8004', nome: 'Avaliação Escrita', valor: 3.0, disabled: false },
  ];

  function sampleGradeForU1(studentIdx, avIdx) {
    if (studentIdx < 30) {
      return avIdx === 0 ? '2.5' : avIdx === 1 ? '2.5' : '3.0'; // total 8.0 (Aprovado)
    }
    if (studentIdx < 40) {
      return avIdx === 0 ? '1.5' : avIdx === 1 ? '1.0' : '1.5'; // total 4.0 (Recuperação)
    }
    return ''; // Sem Nota
  }

  function renderUnitRows(ativs, unitNum, prefix, includeRecConflictOnFirst = false) {
    return FICTIONAL_STUDENTS.map((st, idx) => {
      const pcdIcon = st.pcd ? ' <span aria-hidden="true">\uF193</span>' : '';
      const avCells = ativs
        .map(
          (av, avIdx) => `
          <td>
            <input id="formulario:${prefix}:${idx}:av__${av.id}"
                   name="formulario:${prefix}:${idx}:av__${av.id}"
                   type="text" value="${unitNum === 1 ? sampleGradeForU1(idx, avIdx) : ''}" class="avaliacao" maxlength="4" size="3"
                   ${av.disabled ? 'disabled="disabled"' : ''}
                   onblur="A4J.AJAX.Submit('formulario', event, {'inputId':'formulario:${prefix}:${idx}:av__${av.id}','studentIndex':${idx},'unit':${unitNum}});" />
          </td>`
        )
        .join('');

      // Aluno 0 tem Rec. da Unidade preenchida na unidade aberta se includeRecConflictOnFirst for false?
      // Vamos colocar Rec. preenchida no aluno 44 (ENZO FIGUEIREDO SALLES) apenas no teste de conflito
      // OU no aluno 44 para testar rec_conflict sem impedir os 44 alunos? Melhor: aluno 44 tem rec_conflict?
      // O SLA exige 45 alunos x 4 atividades = 180 lançamentos na unidade aberta! Então deixamos os 45 alunos livres na U3,
      // e na U2 (fechada/mista) ou num caso separado de fixture? Não, U1 tem disabled e U2 tem nuREC__2 preenchida no aluno 0!
      const recVal = includeRecConflictOnFirst && idx === 0 ? '5.0' : '';
      return `
        <tr>
          <td>${st.nome}${pcdIcon}</td>
          ${avCells}
          <td>
            <input id="formulario:${prefix}:${idx}:nuREC__${unitNum}"
                   name="formulario:${prefix}:${idx}:nuREC__${unitNum}"
                   type="text" value="${recVal}" maxlength="4" size="3"
                   ${ativs.every((a) => a.disabled) && !includeRecConflictOnFirst ? 'disabled="disabled"' : ''} />
          </td>
          <td>
            <input id="formulario:${prefix}:${idx}:nu__${unitNum}"
                   name="formulario:${prefix}:${idx}:nu__${unitNum}"
                   type="text" value="" class="noEdit" size="3" disabled="disabled" />
          </td>
        </tr>
      `;
    }).join('');
  }

  const tabsNav = semestral
    ? `
      <li class="ui-state-default ui-corner-top ui-tabs-selected ui-state-active"><a href="#formulario:tab1"><em>1ª Unidade</em></a></li>
      <li class="ui-state-default ui-corner-top"><a href="#formulario:tab1j_id_1"><em>2ª Unidade</em></a></li>
      <li class="ui-state-default ui-corner-top"><a href="#formulario:resF"><em>Res. Final</em></a></li>
    `
    : `
      <li class="ui-state-default ui-corner-top"><a href="#formulario:tab1"><em>1ª Unidade</em></a></li>
      <li class="ui-state-default ui-corner-top"><a href="#formulario:tab1j_id_1"><em>2ª Unidade</em></a></li>
      <li class="ui-state-default ui-corner-top ui-tabs-selected ui-state-active"><a href="#formulario:tab1j_id_2"><em>3ª Unidade</em></a></li>
      <li class="ui-state-default ui-corner-top"><a href="#formulario:resF"><em>Res. Final</em></a></li>
    `;

  const tabsPanels = semestral
    ? `
      <div id="formulario:tab1" class="ui-tabs-panel ui-widget-content">
        <table>
          <thead>
            <tr>
              <th>Estudante</th>
              ${atividadesU1.map((a) => `<th>${a.nome} Valor: ${a.valor.toFixed(1)}</th>`).join('')}
              <th>Rec. da Unidade</th><th>Nota da Unidade</th>
            </tr>
          </thead>
          <tbody>${renderUnitRows(atividadesU1, 1, 'result', false)}</tbody>
        </table>
      </div>
      <div id="formulario:tab1j_id_1" class="ui-tabs-panel ui-widget-content ui-tabs-hide">
        <table><thead><tr><th>Estudante</th><th>Avaliações</th><th>Nota da Unidade</th></tr></thead><tbody></tbody></table>
      </div>
    `
    : `
      <div id="formulario:tab1" class="ui-tabs-panel ui-widget-content ui-tabs-hide">
        <table>
          <thead>
            <tr>
              <th>Estudante</th>
              ${atividadesU1.map((a) => `<th>${a.nome} Valor: ${a.valor.toFixed(1)} Lançamento de notas não permitido.</th>`).join('')}
              <th>Rec. da Unidade</th><th>Nota da Unidade</th>
            </tr>
          </thead>
          <tbody>${renderUnitRows(atividadesU1, 1, 'result', false)}</tbody>
        </table>
      </div>
      <div id="formulario:tab1j_id_1" class="ui-tabs-panel ui-widget-content ui-tabs-hide">
        <table>
          <thead>
            <tr>
              <th>Estudante</th>
              <th>Participação Valor: 2.0 Lançamento de notas não permitido.</th>
              <th>Rec. da Unidade</th><th>Nota da Unidade</th>
            </tr>
          </thead>
          <tbody>${renderUnitRows([{ id: '7201', nome: 'Participação', valor: 2.0, disabled: true }], 2, 'resultj_id_1', true)}</tbody>
        </table>
      </div>
      <div id="formulario:tab1j_id_2" class="ui-tabs-panel ui-widget-content">
        <table>
          <thead>
            <tr>
              <th>Estudante</th>
              ${atividadesU3.map((a) => `<th>${a.nome} Valor: ${a.valor.toFixed(1)}</th>`).join('')}
              <th>Rec. da Unidade</th><th>Nota da Unidade</th>
            </tr>
          </thead>
          <tbody>${renderUnitRows(atividadesU3, 3, 'resultj_id_2', false)}</tbody>
        </table>
      </div>
    `;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>SIGEduc - Lançar Resultados (Fixture)</title>
  <style>
    body { font-family: Verdana, sans-serif; font-size: 12px; margin: 16px; background: #f8fafc; }
    table { border-collapse: collapse; width: 100%; background: #fff; margin-bottom: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; }
    th { background: #e2e8f0; }
    .ui-tabs-nav { list-style: none; display: flex; gap: 6px; padding: 0; margin: 12px 0 0; }
    .ui-tabs-nav li { border: 1px solid #94a3b8; padding: 6px 12px; background: #e2e8f0; cursor: pointer; }
    .ui-tabs-nav li.ui-tabs-selected { background: #fff; font-weight: bold; }
    .ui-tabs-hide { display: none; }
    #confirmacaoSenhaDialogWrap { display: none; border: 2px solid #404E82; background: #fff; padding: 14px; margin-top: 12px; }
    .ui-dialog { position: relative; border: 2px solid #404E82; background: #fff; padding: 14px; margin-top: 12px; }
    .ui-dialog-buttonpane { display: flex; gap: 8px; margin-top: 10px; }
  </style>
</head>
<body>
  <div style="margin-bottom:8px;"><a href="/sigeduc/verPortalDocente.do">Menu Professor</a></div>
  <h2>Diário de Classe Digital &gt; Lançar Notas para Avaliações das Unidades</h2>
  <table>
    <caption>Lançar Notas para Avaliações das Unidades</caption>
    <tr><td>Escola:</td><td>ESCOLA MODELO ESTADUAL</td></tr>
    <tr><td>Turma:</td><td>${semestral ? 'TÉCNICO EM ADMINISTRAÇÃO-SUBSEQUENTE - MÓDULO I - TURMA-SEM-M1 / NOTURNO' : 'TÉCNICO EM INFORMÁTICA-ENSINO MÉDIO INTEGRADO - 1ª SÉRIE - TURMA-ANUAL-1A / VESPERTINO'}</td></tr>
    <tr><td>Componente:</td><td>${semestral ? 'INFORMÁTICA APLICADA' : 'EDUCAÇÃO DIGITAL E MIDIÁTICA'}</td></tr>
    <tr><td>Total Aulas:</td><td>40</td></tr>
  </table>

  <form id="formulario" method="post" action="/sigeduc/diario_classe/lancar_notas/form_estudantes_notas_avaliacoes_unidade.jsf">
    <input type="hidden" name="DOUBLE_CHECK_TOKEN" value="mock-token-notas" />
    <input type="hidden" name="javax.faces.ViewState" value="j_id2" />
    <div id="formulario:tabViewId" class="ui-tabs">
      <ul class="ui-tabs-nav">${tabsNav}</ul>
      ${tabsPanels}
      <div id="formulario:resF" class="ui-tabs-panel ui-widget-content ui-tabs-hide">
        <table><thead><tr><th>Estudante</th><th>Média</th><th>Res. Parcial</th></tr></thead><tbody></tbody></table>
      </div>
    </div>

    <input id="formulario:btnAbrirConfirmacaoSenha" type="submit" value="Gravar" onclick="document.getElementById('confirmacaoSenhaDialogWrap').style.display='block'; return false;" />
    <div id="confirmacaoSenhaDialogWrap">
      <div id="formulario:confirmacaoSenhaDialog">
        <label for="formulario:senha">Senha:</label>
        <input id="formulario:senha" type="password" name="formulario:senha" value="" />
        <input id="formulario:confirmarGravacaoNotas" type="submit" value="Confirmar" onclick="return window.__handleConfirmNotas();" />
      </div>
    </div>
    <div id="confirmationDialogWrap" class="ui-dialog ui-widget ui-widget-content ui-corner-all" style="display: none;">
      <div id="formulario:confirmationDialog" class="ui-dialog-content ui-widget-content">
        <p><strong>Confirmar</strong></p>
        <p>Verificar e registrar atividades não realizadas após o lançamento de notas</p>
        <div class="ui-dialog-buttonpane">
          <button type="button" class="ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only ui-button-danger" onclick="document.getElementById('confirmationDialogWrap').style.display='none';">
            <span class="ui-button-text">Não</span>
          </button>
          <button type="button" class="acao-confirmacao-senha ui-button-success ui-button ui-widget ui-state-default ui-corner-all ui-button-text-only" onclick="window.__nrDialogAccepted = true; window.location.href='/sigeduc/diario_classe/lancar_notas/form_estudantes_realizacoes_avaliacoes_unidade.jsf';">
            <span class="ui-button-text">Sim</span>
          </button>
        </div>
      </div>
    </div>
  </form>

  <script>
    window.__handleConfirmNotas = function() {
      window.__notasSaved = true;
      var activePanel = document.querySelector('#formulario\\\\:tabViewId .ui-tabs-panel:not(.ui-tabs-hide)');
      var emptyCount = 0;
      if (activePanel) {
        activePanel.querySelectorAll('input.avaliacao:not([disabled])').forEach(function(inp) {
          if (String(inp.value || '').trim() === '') emptyCount++;
        });
      }
      if (emptyCount > 0) {
        var wrap = document.getElementById('confirmationDialogWrap');
        if (wrap) wrap.style.display = 'block';
      }
      return false;
    };

    window.A4J = {
      AJAX: {
        Submit: function(formId, ev, opts) {
          var xhr = new XMLHttpRequest();
          xhr.open('POST', '/sigeduc/diario_classe/lancar_notas/form_estudantes_notas_avaliacoes_unidade.jsf', true);
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
              try {
                var data = JSON.parse(xhr.responseText);
                if (data && data.unitInputId) {
                  var el = document.getElementById(data.unitInputId);
                  if (el) el.value = data.unitTotal;
                }
              } catch (e) {}
            }
          };
          var inputEl = document.getElementById(opts.inputId);
          var row = inputEl ? inputEl.closest('tr') : null;
          var sum = 0;
          if (row) {
            row.querySelectorAll('input.avaliacao').forEach(function(inp) {
              var v = parseFloat(String(inp.value || '').replace(',', '.'));
              if (!isNaN(v)) sum += v;
            });
          }
          var unitId = 'formulario:' + (opts.inputId.split(':')[1]) + ':' + opts.studentIndex + ':nu__' + opts.unit;
          xhr.send('AJAXREQUEST=' + encodeURIComponent(formId) + '&inputId=' + encodeURIComponent(opts.inputId) + '&unitInputId=' + encodeURIComponent(unitId) + '&unitTotal=' + encodeURIComponent(sum.toFixed(1)));
        }
      }
    };

    document.querySelectorAll('#formulario\\\\:tabViewId .ui-tabs-nav a').forEach(function(a) {
      a.addEventListener('click', function(ev) {
        ev.preventDefault();
        var targetId = a.getAttribute('href').slice(1);
        document.querySelectorAll('#formulario\\\\:tabViewId .ui-tabs-nav li').forEach(function(li) {
          li.classList.remove('ui-tabs-selected', 'ui-state-active');
        });
        a.closest('li').classList.add('ui-tabs-selected', 'ui-state-active');
        document.querySelectorAll('#formulario\\\\:tabViewId .ui-tabs-panel').forEach(function(p) {
          if (p.id === targetId) p.classList.remove('ui-tabs-hide');
          else p.classList.add('ui-tabs-hide');
        });
      });
    });
  </script>
</body>
</html>`;
}

function buildFrequenciaHtml() {
  const rowsHtml = FICTIONAL_STUDENTS.map((st, idx) => {
    const pcdIcon = st.pcd ? ' <span aria-hidden="true">\uF193</span>' : '';
    return `
      <tr class="${idx % 2 === 0 ? 'linhaPar' : 'linhaImpar'}">
        <td>${idx + 1}</td>
        <td>${st.matricula}</td>
        <td><div>${st.nome}${pcdIcon}</div></td>
        <td><textarea id="formFrequencia:rows:${idx}:observacaoInput" name="formFrequencia:rows:${idx}:observacaoInput" cols="25" rows="2"></textarea></td>
        <td><input id="formFrequencia:rows:${idx}:slot0" type="checkbox" /></td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>SIGEduc - Informar Frequência (Fixture)</title>
  <style>
    body { font-family: Verdana, sans-serif; font-size: 12px; margin: 16px; background: #f8fafc; }
    .layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; }
    table { border-collapse: collapse; width: 100%; background: #fff; margin-bottom: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; }
    th { background: #e2e8f0; }
    @media (max-width: 640px) { .layout { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div style="margin-bottom:8px;"><a href="/sigeduc/verPortalDocente.do">Menu Professor</a></div>
  <h2>Diário de Classe Digital &gt; Informar Frequência da Turma</h2>
  <p>Todos os estudantes por padrão possuem 100% de presença. Marcar significa que o estudante FALTOU.</p>
  <table id="dadosTurma">
    <caption>Dados da Turma</caption>
    <tr><td>Escola:</td><td>ESCOLA MODELO ESTADUAL</td></tr>
    <tr><td>Turma:</td><td>TÉCNICO EM INFORMÁTICA - 1ª SÉRIE - TURMA-ANUAL-1A / VESPERTINO</td></tr>
    <tr><td>Componente:</td><td>EDUCAÇÃO DIGITAL E MIDIÁTICA</td></tr>
    <tr><td>Horário(s):</td><td>45T1</td></tr>
  </table>

  <div class="layout">
    <form id="formCalendarios" method="post" action="/sigeduc/diario_classe/frequencia_aluno/form.jsf">
      <input type="hidden" name="DOUBLE_CHECK_TOKEN" value="mock-token-cal" />
      <table>
        <caption>Agosto</caption>
        <thead><tr><th>D</th><th>S</th><th>T</th><th>Q</th><th>Q</th><th>S</th><th>S</th></tr></thead>
        <tbody>
          <tr>
            <td></td><td></td><td></td><td></td><td></td><td></td><td>1</td>
          </tr>
          <tr>
            <td>2</td><td>3</td><td>4</td>
            <td><a href="#" id="cal-05-08" onclick="A4J.AJAX.Submit('formCalendarios', event, {'mes':7,'diaSemana':4,'ano':2026,'dia':5}); return false;">5</a></td>
            <td>6</td><td>7</td><td>8</td>
          </tr>
          <tr>
            <td>9</td><td>10</td><td>11</td>
            <td><a href="#" id="cal-12-08" onclick="A4J.AJAX.Submit('formCalendarios', event, {'mes':7,'diaSemana':4,'ano':2026,'dia':12}); return false;">12</a></td>
            <td>13</td><td>14</td><td>15</td>
          </tr>
          <tr>
            <td>16</td><td>17</td><td>18</td>
            <td><a href="#" id="cal-19-08" onclick="A4J.AJAX.Submit('formCalendarios', event, {'mes':7,'diaSemana':4,'ano':2026,'dia':19}); return false;">19</a></td>
            <td>20</td><td>21</td><td>22</td>
          </tr>
        </tbody>
      </table>
    </form>

    <form id="formFrequencia" method="post" action="/sigeduc/diario_classe/frequencia_aluno/form.jsf">
      <input type="hidden" name="DOUBLE_CHECK_TOKEN" value="mock-token-freq" />
      <table id="tabelaFrequencia">
        <caption id="freqCaption">Lista de Frequência - 05/08/2026</caption>
        <thead id="freqThead">
          <tr><th>#</th><th>Matrícula</th><th>Nome</th><th>Observação</th><th>1° horário</th></tr>
        </thead>
        <tbody id="freqTbody">${rowsHtml}</tbody>
      </table>
      <div>
        <label for="formFrequencia:senha">Senha:</label>
        <input id="formFrequencia:senha" type="password" name="formFrequencia:senha" value="" />
        <input id="formFrequencia:botaoGravarFreq" type="submit" value="Gravar Frequências" onclick="if (confirm('Deseja realmente gravar as frequências?')) { window.__freqSaved = (window.__freqSaved || 0) + 1; return false; } return false;" />
      </div>
    </form>
  </div>

  <script>
    // Simula bloqueio real de Ctrl+V e paste do SIGEduc no document
    window.__sigeducPasteBlockedCount = 0;
    document.addEventListener('paste', function(ev) {
      window.__sigeducPasteBlockedCount++;
      ev.preventDefault();
    });
    document.addEventListener('keydown', function(ev) {
      if (ev.ctrlKey && (ev.key === 'v' || ev.key === 'V')) {
        window.__sigeducPasteBlockedCount++;
        ev.preventDefault();
      }
    });

    window.A4J = {
      AJAX: {
        Submit: function(formId, ev, params) {
          var xhr = new XMLHttpRequest();
          xhr.open('POST', '/sigeduc/diario_classe/frequencia_aluno/form.jsf', true);
          xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
          xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
              var d = JSON.parse(xhr.responseText);
              document.getElementById('freqCaption').textContent = 'Lista de Frequência - ' + d.dateDisplay;
              var slots = d.slots || 1;
              var theadHtml = '<tr><th>#</th><th>Matrícula</th><th>Nome</th><th>Observação</th>';
              for (var s = 0; s < slots; s++) {
                theadHtml += '<th>' + (s + 1) + '° horário</th>';
              }
              theadHtml += '</tr>';
              document.getElementById('freqThead').innerHTML = theadHtml;
              var rows = document.querySelectorAll('#freqTbody tr');
              rows.forEach(function(tr, idx) {
                while (tr.children.length > 4) tr.removeChild(tr.lastElementChild);
                for (var s = 0; s < slots; s++) {
                  var td = document.createElement('td');
                  var cb = document.createElement('input');
                  cb.type = 'checkbox';
                  cb.id = 'formFrequencia:rows:' + idx + ':slot' + s;
                  td.appendChild(cb);
                  tr.appendChild(td);
                }
              });
            }
          };
          xhr.send('dia=' + params.dia + '&mes=' + params.mes + '&ano=' + params.ano);
        }
      }
    };
  </script>
</body>
</html>`;
}

const avaliacoesHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>SIGEduc - Gerenciar Avaliações (Fixture)</title>
  <style>
    body { font-family: Verdana, sans-serif; font-size: 12px; margin: 16px; background: #f8fafc; }
    table { border-collapse: collapse; width: 100%; background: #fff; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }
  </style>
</head>
<body>
  <h2>Diário de Classe Digital &gt; Gerenciar Grupos de Avaliação da Unidade</h2>
  <form id="form" method="post" action="/sigeduc/ensino/grupo_avaliacao_unidade/lista.jsf">
    <table>
      <caption>Lista de Unidades da Turma 2026 - EDUCAÇÃO DIGITAL E MIDIÁTICA - Turma TURMA-ANUAL-1A</caption>
      <tbody>
        <tr><td>1ª Unidade</td><td>Gerenciar Avaliações</td></tr>
        <tr>
          <td colspan="2">
            <table>
              <tbody>
                <tr><td>Descrição</td><td>Data da Avaliação</td><td>Tipo</td><td>Categoria</td><td>Ordem</td><td>Valor</td></tr>
                <tr><td>Atividades em sala</td><td>23/03/2026</td><td>Atividade Presencial</td><td>Atividade Presencial</td><td>1</td><td>3.0</td></tr>
                <tr><td>Teste</td><td>27/03/2026</td><td>Prova</td><td>Atividade Presencial</td><td>2</td><td>3.0</td></tr>
                <tr><td>Simulado</td><td>14/05/2026</td><td>Prova</td><td>Atividade Presencial</td><td>3</td><td>4.0</td></tr>
              </tbody>
            </table>
          </td>
        </tr>
        <tr><td>3ª Unidade</td><td>Gerenciar Avaliações</td></tr>
        <tr>
          <td colspan="2">
            <table>
              <tbody>
                <tr><td>Descrição</td><td>Data da Avaliação</td><td>Tipo</td><td>Categoria</td><td>Ordem</td><td>Valor</td></tr>
                <tr><td>Participação</td><td>15/09/2026</td><td>Participação</td><td>Atividade Presencial</td><td>1</td><td>2.0</td></tr>
                <tr><td>Atividade Prática</td><td>30/09/2026</td><td>Atividade Presencial</td><td>Atividade Presencial</td><td>2</td><td>3.0</td></tr>
                <tr><td>Seminário</td><td>20/10/2026</td><td>Seminário</td><td>Atividade Presencial</td><td>3</td><td>2.0</td></tr>
                <tr><td>Avaliação Escrita</td><td>10/11/2026</td><td>Prova</td><td>Atividade Presencial</td><td>4</td><td>3.0</td></tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  </form>
</body>
</html>`;

function buildNaoRealizadasHtml() {
  const atividadesU3 = [
    { id: '8001', nome: 'Participação', valor: 2.0 },
    { id: '8002', nome: 'Atividade Prática', valor: 3.0 },
    { id: '8003', nome: 'Seminário', valor: 2.0 },
    { id: '8004', nome: 'Avaliação Escrita', valor: 3.0 },
  ];

  const rowsHtml = FICTIONAL_STUDENTS.map((st, idx) => {
    const pcdIcon = st.pcd ? ' <span aria-hidden="true">\uF193</span>' : '';
    const cbCells = atividadesU3
      .map(
        (av) => `
          <td>
            <input id="formulario:resultj_id_2:${idx}:av__${av.id}"
                   name="formulario:resultj_id_2:${idx}:av__${av.id}"
                   type="checkbox" class="avaliacao" />
          </td>`
      )
      .join('');
    return `
      <tr>
        <td>${st.nome}${pcdIcon}</td>
        ${cbCells}
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>SIGEduc - Verificar Avaliações Não Realizadas (Fixture)</title>
  <style>
    body { font-family: Verdana, sans-serif; font-size: 12px; margin: 16px; background: #f8fafc; }
    table { border-collapse: collapse; width: 100%; background: #fff; margin-bottom: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; }
    th { background: #e2e8f0; }
    .ui-tabs-nav { list-style: none; display: flex; gap: 6px; padding: 0; margin: 12px 0 0; }
    .ui-tabs-nav li { border: 1px solid #94a3b8; padding: 6px 12px; background: #e2e8f0; }
    .ui-tabs-nav li.ui-tabs-selected { background: #fff; font-weight: bold; }
    .ui-tabs-hide { display: none; }
    #confirmacaoSenhaFvWrap { display: none; border: 2px solid #404E82; background: #fff; padding: 14px; margin-top: 12px; }
  </style>
</head>
<body>
  <h2>Diário de Classe Digital &gt; Verificar Avaliações Não Realizadas</h2>
  <table>
    <caption>Verificar Avaliações não realizadas</caption>
    <tr><td>Escola:</td><td>ESCOLA MODELO ESTADUAL</td></tr>
    <tr><td>Turma:</td><td>TÉCNICO EM INFORMÁTICA-ENSINO MÉDIO INTEGRADO - 1ª SÉRIE - TURMA-ANUAL-1A / VESPERTINO</td></tr>
    <tr><td>Componente:</td><td>EDUCAÇÃO DIGITAL E MIDIÁTICA</td></tr>
  </table>

  <form id="formulario" method="post" action="/sigeduc/diario_classe/lancar_notas/form_estudantes_realizacoes_avaliacoes_unidade.jsf">
    <input type="hidden" name="DOUBLE_CHECK_TOKEN" value="mock-token-nr" />
    <input type="hidden" name="javax.faces.ViewState" value="j_id_nr_1" />
    <div id="formulario:tabViewId" class="ui-tabs">
      <ul class="ui-tabs-nav">
        <li class="ui-state-default ui-corner-top"><a href="#formulario:tab1"><em>1ª Unidade</em></a></li>
        <li class="ui-state-default ui-corner-top"><a href="#formulario:tab1j_id_1"><em>2ª Unidade</em></a></li>
        <li class="ui-state-default ui-corner-top ui-tabs-selected ui-state-active"><a href="#formulario:tab1j_id_2"><em>3ª Unidade</em></a></li>
      </ul>
      <div id="formulario:tab1" class="ui-tabs-panel ui-widget-content ui-tabs-hide"></div>
      <div id="formulario:tab1j_id_1" class="ui-tabs-panel ui-widget-content ui-tabs-hide"></div>
      <div id="formulario:tab1j_id_2" class="ui-tabs-panel ui-widget-content">
        <table id="formulario:resultj_id_2">
          <thead>
            <tr>
              <th>Estudante</th>
              ${atividadesU3.map((a) => `<th><span class="nome-avaliacao">${a.nome}</span> <span class="valor-avaliacao">Valor: ${a.valor.toFixed(1)}</span></th>`).join('')}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>

    <input id="formulario:btnAbrirConfirmacaoSenhaFv" type="submit" value="Gravar" onclick="document.getElementById('confirmacaoSenhaFvWrap').style.display='block'; return false;" />
    <div id="confirmacaoSenhaFvWrap">
      <label for="formulario:senha">Senha:</label>
      <input id="formulario:senha" type="password" name="formulario:senha" value="" />
      <input id="formulario:confirmarGravacaoFvTurmaRegular" type="submit" value="Confirmar" onclick="window.__nrSaved = true; return false;" />
    </div>
  </form>
</body>
</html>`;
}

fs.writeFileSync(path.join(fixturesDir, 'docente.html'), docenteHtml, 'utf8');
fs.writeFileSync(path.join(fixturesDir, 'lancar_notas_anual.html'), buildNotasHtml({ semestral: false }), 'utf8');
fs.writeFileSync(path.join(fixturesDir, 'lancar_notas_semestral.html'), buildNotasHtml({ semestral: true }), 'utf8');
fs.writeFileSync(path.join(fixturesDir, 'avaliacoes_nao_realizadas.html'), buildNaoRealizadasHtml(), 'utf8');
fs.writeFileSync(path.join(fixturesDir, 'lancar_frequencia.html'), buildFrequenciaHtml(), 'utf8');
fs.writeFileSync(path.join(fixturesDir, 'gerenciar_avaliacoes.html'), avaliacoesHtml, 'utf8');

if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  console.log('Fixtures sanitizadas criadas em trabalho/fixtures/');
}
