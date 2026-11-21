# Roadmap — Preenche SIGEduc

Documento vivo de planejamento e evolução técnica do projeto **Preenche SIGEduc**.
As sugestões são organizadas sob a ótica de engenharia sênior, equilibrando **impacto para o usuário/operação**, **risco técnico** (considerando as invariantes do `AGENTS.md` e os requisitos do `SPEC.md`) e **dificuldade de implementação**. Toda feature implementada a partir deste roadmap deve manter o `SPEC.md` sincronizado.

## Critérios de Classificação

### Prioridade
- **P0 — Crítico:** Correções de bugs severos, segurança, privacidade ou quebra de fluxo principal no SIGEduc.
- **P1 — Alta:** Melhorias de alto impacto direto na produtividade do docente ou robustez da extensão.
- **P2 — Média:** Melhorias de experiência de uso (UX), automações secundárias e qualidade de vida.
- **P3 — Baixa / Futuro:** Ideias exploratórias, refinamentos visuais ou recursos de nicho.

### Dificuldade de Implementação
- **Baixa:** Alteração localizada (UI pontual, ajuste de parser, regra simples), baixo risco de regressão.
- **Média:** Envolve múltiplos módulos (`src/core/` + `src/sigeduc/` + `src/ui/`), novos testes unitários/E2E ou cuidados com estado JSF/AJAX.
- **Alta:** Mudança arquitetural, manipulação complexa de ciclo de vida RichFaces/JSF, compatibilidade cross-browser ou alto risco de regressão.

---

## P0 — Crítico
*(Nenhum item registrado ainda)*

## P1 — Alta Prioridade

### 1. Registro de "Não Realização" de Atividades após Lançamento de Notas
- **Prioridade:** P1 — Alta
- **Dificuldade:** Média
- **Contexto:** Ao salvar notas com campos vazios, o SIGEduc exibe o modal *"Verificar e registrar atividades não realizadas após o lançamento de notas"* (`Não` / `Sim`). Ao confirmar, abre uma matriz Estudante × Avaliação com checkboxes de não realização.
- **Comportamento esperado:**
  - Diferenciar explicitamente na planilha/parser (`src/core/grades.ts`):
    - `0` / `0,0` → Nota zero real (lança `0.0` no input de nota).
    - `Não Fez`, `NF`, `FV` ou célula em branco → Não realização (deixa nota vazia e marca o checkbox na etapa seguinte).
  - Detectar o modal pós-lançamento, acionar `Sim` automaticamente (ou sob confirmação do usuário) quando houver pendências de não realização, e marcar os checkboxes correspondentes na tabela do SIGEduc.
- **Impacto técnico / Riscos:** Requer extensão do parser de notas, novo fluxo no `filler-notas.ts` (aguardando DOM/AJAX do modal e da tabela de checkboxes) e cobertura no `mock-server.mjs` + testes E2E.

### 2. Manter Aba de Mapeamento de Colunas Aberta Durante Seleção/Inserção em Notas
- **Prioridade:** P1 — Alta
- **Dificuldade:** Baixa
- **Contexto:** Após importar a planilha e identificar as colunas, ao selecionar outra coluna e clicar para inserir/aplicar no preenchimento de notas, a aba/seção de mapeamento se recolhe sozinha, obrigando o usuário a reabri-la repetidamente.
- **Comportamento esperado:** Preservar o estado aberto da seção de mapeamento durante re-renderizações ou trocas de coluna, recolhendo apenas por ação explícita do usuário.
- **Impacto técnico / Riscos:** Ajuste localizado no controle de estado da UI em `src/ui/panel.ts`. Baixo risco de regressão.

## P2 — Média Prioridade

### 1. Opção de Aumento do Tamanho do Texto (Acessibilidade)
- **Prioridade:** P2 — Média
- **Dificuldade:** Baixa
- **Contexto:** Docentes utilizando telas pequenas, mobile (`<=640px`) ou com necessidade de maior legibilidade se beneficiam de controle de escala tipográfica no painel.
- **Comportamento esperado:** Controle no painel (ex.: `A-` / `A+` ou seletor Normal / Grande / Extra Grande) aplicando escala via variáveis CSS dentro do Shadow DOM (`src/ui/styles.ts` e `src/ui/panel.ts`), com preferência salva localmente.
- **Impacto técnico / Riscos:** Isolado no Shadow DOM; atenção apenas para não quebrar layout responsivo em `<=640px`.

### 2. Visual Noturno (Dark Mode)
- **Prioridade:** P2 — Média
- **Dificuldade:** Baixa
- **Contexto:** Uso prolongado do painel à noite gera fadiga visual com tema claro.
- **Comportamento esperado:** Alternância entre tema claro e escuro via tokens CSS no Shadow DOM (`src/ui/styles.ts`), respeitando `prefers-color-scheme` como padrão opcional e salvando a escolha do usuário localmente.
- **Impacto técnico / Riscos:** Isolado no Shadow DOM (`#preenche-sigeduc-host`), sem interferir no CSS da página do SIGEduc.

## P3 — Baixa Prioridade / Futuro
*(Nenhum item registrado ainda)*
