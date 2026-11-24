# HARNESS.md — Harness de Verificação Autônoma

Este documento define o protocolo completo de execução, validação de SLAs e auditoria adversarial do projeto **Preenche SIGEduc**.

## 1. Execução do Harness Automatizado

Comando único:

```bash
npm run harness
```

Executado por [`trabalho/harness.mjs`](trabalho/harness.mjs), o pipeline percorre os seguintes portões em sequência estrita (falha em qualquer etapa interrompe com `exit code != 0`):

| Ordem | Etapa | Comando / Ação | Critério de Aprovação |
| :---: | :--- | :--- | :--- |
| 1 | **Typecheck** | `npx tsc --noEmit` | 0 erros TypeScript (`strict: true`). |
| 2 | **Build MV3** | `npm run build` | Gera `dist/chrome/`, `dist/firefox/` e `trabalho/dist-e2e/`. |
| 3 | **Empacotamento** | `npm run package` | Gera `.zip` Chrome/Firefox e valida tamanho descompactado `< 1536 KB`. |
| 4 | **Testes Unitários** | `npm run test:unit` | 100% dos testes Vitest em `tests/unit/` verdes. |
| 5 | **Benchmarks SLA** | `npm run benchmark` | Parse 500×10 `< 250 ms` (p99), abertura `< 100 ms`, perda AJAX `= 0%`, matching `45/45` exato e `0` falsos positivos. |
| 6 | **Testes E2E** | `npm run test:e2e` | Chromium carregando `trabalho/dist-e2e/` via CDP contra `trabalho/mock-server.mjs` em `1280x720` e `390x844`, gerando `trabalho/evidencias/`. |
| 7 | **Auditoria de Pacote, Evidências e Backlog Menor** | Validação interna do harness | Confirma ausência de `127.0.0.1`, `trabalho/` e `.pem`/`.key` em `dist/`, valida CRX3 + SHA-256 + SLA `< 512 KB` dos pacotes, confere 24 evidências em `trabalho/evidencias/manifest.json` e audita `trabalho/critico_backlog.json` (teto `<= 5` abertos e testes verificados para cada item `resolvido`). |

---

## 2. Portão do Crítico Independente (Subagente Cego)

Após `npm run harness` retornar `0`, invoque um subagente novo (`research`) **sem acesso ou menção a código-fonte** (`src/`, `tests/`, `scripts/`), fornecendo exclusivamente:
- Os arquivos listados em `trabalho/evidencias/manifest.json` (capturas PNG Desktop `1280x720` e Mobile `390x844`, planilhas `.xlsx`/`.csv`/`.json` exportadas e relatórios JSON).
- A rubrica e escala de severidade abaixo.

### Rubrica de Avaliação
1. **Legibilidade e Clareza:** Textos nítidos, contraste adequado e botões identificáveis em todas as abas.
2. **Responsividade Mobile (`390x844`):** Painel ajustado à tela sem cortes de texto, sem overflow horizontal e com alvos de toque confortáveis.
3. **Clareza do Relatório de Divergências:** Diferenciação imediata entre alunos casados, não encontrados, homônimos/duplicados, valores inválidos/acima do máximo e campos bloqueados.
4. **Integridade das Planilhas/Arquivos Exportados:** Colunas bem formadas, sem corrupção de caracteres, datas legíveis e estrutura pronta para preenchimento.

### Escala de Severidade
- **`grave`:** Erro de atribuição de nota/falta, UI inutilizável ou cortada no mobile, vazamento de dados/senha ou planilha exportada inválida.
- **`médio`:** Ambiguidade visual no mapeamento/relatório, alvo de toque pequeno no mobile ou inconsistência de feedback de progresso.
- **`menor`:** Polimento estético, espaçamento ou microtexto.

**Critério de parada:** Iterar corrigindo tudo acima de `menor`, reexecutando `npm run harness` e invocando um **novo** subagente cego a cada rodada, até zero defeitos `grave` ou `médio`.

### Acúmulo e Auditoria de Achados `menor`
- Toda observação `menor` apontada pelo Crítico Independente deve ser registrada em [`trabalho/critico_backlog.json`](trabalho/critico_backlog.json) com ID (`CR-NNN`), rodada, descrição, status (`aberto`, `agendado`, `aceito_design` ou `resolvido`) e referência de teste (`testFile` + `testPattern`).
- Itens adiados como `agendado` devem ser referenciados pelo ID no `Roadmap.md`.
- O `trabalho/harness.mjs` falha se houver mais de `5` achados `menor` abertos/agendados acumulados ou se algum item marcado como `resolvido` não apontar para um teste real verificável em `tests/` ou `trabalho/`, regenerando automaticamente a visão em tabela em [`trabalho/critico_backlog.md`](trabalho/critico_backlog.md).

---

## 3. Critério Final de "Pronto"

O projeto é considerado concluído apenas quando:
1. `npm run harness` termina com `exit code 0` e `trabalho/harness_status.json` com `overallStatus: "PASSED"`.
2. `trabalho/relatorio_critico.md` registra aprovação do Crítico Independente sem defeitos `grave` ou `médio`.
3. `dist/chrome/`, `dist/firefox/`, `dist/preenche-sigeduc-chrome.zip`, `dist/preenche-sigeduc-firefox.zip`, `SPEC.md`, `README.md`, `AGENTS.md` e `HARNESS.md` estão presentes e atualizados.
