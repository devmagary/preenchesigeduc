# Backlog Auditado de Achados "Menor" — Crítico Independente

Atualizado automaticamente pelo harness em: 2026-11-26T11:08:59.127Z

- **Total catalogado:** 13
- **Resolvidos (com teste verificado):** 8
- **Aceitos por design:** 2
- **Abertos / Agendados:** 3 (limite máximo: 5)

| ID | Rodada | Status | Título | Teste / Verificação Vinculada |
| :--- | :---: | :---: | :--- | :--- |
| **CR-001** | 1 | `resolvido` | Espaçamento e rolagem do painel sem barras externas no mobile | `tests/e2e/extension.spec.mjs` (`Painel mobile não pode ter overflow horizontal`) |
| **CR-002** | 2 | `resolvido` | Contraste WCAG KPI, microtexto (marcado = FALTA), concordância '1 falta' e acentuação 'Modelo Frequência' | `tests/unit/critico-backlog.test.ts` (`CR-002: garante aba Modelo Frequência acentuada e concordância no bundle de exportação`) |
| **CR-003** | 3 | `resolvido` | Evidência frequencia_dia_unico_desktop.png capturava prévia antes da execução | `tests/e2e/extension.spec.mjs` (`CR-003: Executar primeiro o dia único 05/08/2026 no Modo Assistido`) |
| **CR-004** | 3 | `resolvido` | Coluna Resumo de RELATÓRIO POR DATA omitia contagem de ausentes na planilha | `tests/e2e/extension.spec.mjs` (`CR-004: célula Resumo deve explicitar ausentes na planilha`) |
| **CR-005** | 3 | `aceito_design` | Gaveta lateral de 440px encobre parcialmente a direita da tabela em 1280x720 | `tests/e2e/extension.spec.mjs` (`CR-005: confirmar que fechar e reabrir o painel libera e restaura a tabela`) |
| **CR-006** | 3 | `aceito_design` | Normalização de rótulos entre página e exportações (docente sem PROF. e coluna Série/Módulo) | `tests/unit/critico-backlog.test.ts` (`CR-006: normaliza docente sem prefixo PROF. e exporta cabeçalho Série/Módulo`) |
| **CR-007** | 6 | `resolvido` | Ajustes visuais de CETEP e relatório de Não Realizadas (Nota mínima 5.0, dobra mobile e alinhamento JSON) | `tests/e2e/extension.spec.mjs` (`Botão CETEP no mobile deve caber acima da dobra`) |
| **CR-008** | 7 | `resolvido` | Nota informativa sobre cobertura visual da lista de turmas longas | `tests/e2e/extension.spec.mjs` (`Cards adjacentes não podem se sobrepor`) |
| **CR-009** | 9 | `resolvido` | Subtítulo longo de TURMA-LONGA-1-NOTURNO abaixo da dobra interna em cards_turmas_longos_desktop.png | `tests/e2e/extension.spec.mjs` (`CR-009: TURMA-LONGA-1-NOTURNO deve ficar integralmente visível sem corte na lista rolável`) |
| **CR-010** | 10 | `resolvido` | Ausência de SLA explícito e verificação SHA-256 para pacotes .zip e .crx em relatorio_metricas.json | `trabalho/harness.mjs` (`packages_lt_512KB`) |
| **CR-011** | 11 | `agendado` | Checkboxes de frequência sob a gaveta lateral em frequencia_dia_unico_desktop.png | — |
| **CR-012** | 11 | `agendado` | Exibir prefixos SHA-256 dos pacotes .zip/.crx também em trabalho/relatorio_metricas.md | — |
| **CR-013** | 13 | `agendado` | Quebra de linha (wrapText) em rótulos longos da coluna A do Painel Consolidado CETEP | — |
