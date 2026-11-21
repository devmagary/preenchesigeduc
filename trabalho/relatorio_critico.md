# Relatório do Crítico Independente (Auditoria Caixa-Preta)

Auditoria realizada por subagentes independentes (`research`) sem acesso ao código-fonte, avaliando exclusivamente as evidências geradas em `trabalho/evidencias/` (capturas PNG desktop `1280x720` e mobile `390x844`, planilhas `.xlsx`/`.csv`/`.json` e relatórios de execução JSON) contra a rubrica de qualidade de `SPEC.md` e `HARNESS.md`.

## Histórico de Rodadas

### Rodada 1 (`ae936bde`)
- **Achados:** 1 `grave` (corte/ausência de barra de rolagem visível no painel mobile em `notas_previa_mobile.png`), 3 `médio` (prévia/relatórios ocultos abaixo da dobra sem colapsar etapas anteriores; falta de `invalidDetails` no JSON de notas e `invalidCount`/`errors` no JSON de frequência; barras de rolagem externas no mobile `390x844`), 1 `menor`.
- **Correções aplicadas:**
  - Travamento do viewport móvel (`inset: 0; width: 100%; height: 100dvh` e `overflow: hidden` no documento ao abrir em `<= 640px`), barra de rolagem explícita em `.ps-body` e upload estilizado de `44px`.
  - Acordeões colapsáveis para etapas concluídas (Importação e Mapeamento) e exibição do Relatório de Execução no topo após finalizar.
  - Inclusão de `invalidDetails`, `disabledDetails` e `recConflictDetails` em `GradeFillReport`, e `invalidCount`, `invalidDetails` e `errors` em `AttendanceDateResult`.

### Rodada 2 (`27e9534a`)
- **Achados:** **0 `grave`**, 2 `médio` (omissão de `notInSheet`/status de gravação na UI de Frequência; data `Indisponível` pré-marcada na prévia e exibida como `0 faltas / 0 pres.` no relatório) e 5 `menor` (contraste WCAG de dígitos KPI verde/âmbar, microtexto `(marcado = FALTA)` próximo à seleção de datas, contagem de grupos vs ocorrências em divergências, concordância nominal `1 faltas` e acentuação de aba `Modelo Frequencia`).
- **Correções aplicadas:**
  - Pré-seleção automática apenas das datas disponíveis no calendário do SIGEduc, mantendo datas indisponíveis desmarcadas por padrão e exibindo `— (não processada)` no relatório.
  - Exibição explícita de `notInSheet`, datas indisponíveis, avisos e status de gravação na prévia e no relatório de Frequência.
  - Ajuste de cores KPI para contraste WCAG AA (`#047857`, `#b45309`, `#b91c1c`), correção de concordância nominal (`1 falta`), microtexto e acentuação `Modelo Frequência`.

### Rodada 3 — Parecer Final (`79b6d4e2`)
- **Veredito:** **APROVADO — Zero defeitos de severidade `grave` ou `médio`.**
- **Critérios verificados sem defeitos:**
  1. **Legibilidade e contraste (WCAG AA/AAA):** Todas as combinações medidas atingiram `>= 4.5:1` (`4.80:1` a `11.87:1`).
  2. **Responsividade mobile (`390x844`):** Sem cortes laterais, sem overflow horizontal, sem barras externas sobrando, sem sobreposição e alvos de toque `>= 44px`.
  3. **Clareza de divergências e progresso:** Separação explícita de casamentos exatos, não encontrados sem fuzzy matching (`ANA CLARA FERREIRO`), inválidos (`BRUNO HENRIQUE SOUZA`, `"2,5" > 2.0`), ausentes na planilha (`42`) e datas indisponíveis (`25/08/2026`).
  4. **Integridade dos arquivos e privacidade:** `manifest.json` 100% consistente em bytes e SHA-256 com os 16 artefatos; `.xlsx`, `.csv` (UTF-8 BOM, `;`) e `.json` íntegros, com sanitização PUA e sem vazamento de senhas.
- **Observações residuais (`menor`, não bloqueantes):**
  1. `frequencia_dia_unico_desktop.png` captura a prévia multi-datas antes da execução em `05/08/2026`.
  2. Coluna `Resumo` de `RELATÓRIO POR DATA` contabiliza os alunos da planilha (com nota explicativa logo abaixo para os 42 ausentes).
  3. Painel lateral direito em `1280x720` encobre parcialmente a direita da tabela subjacente enquanto aberto.
  4. Normalização de rótulos entre página e exportações (`PROF.` removido em `docente` no JSON e `Série/Módulo` no CSV/XLSX).
