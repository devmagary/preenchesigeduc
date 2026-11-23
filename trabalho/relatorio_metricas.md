# Relatório de Métricas e SLA — Preenche SIGEduc

Gerado em: 2026-11-23T15:37:58.043Z

## 1. Parse de Planilha (500 linhas × 10 colunas, 20 execuções)

| Formato | Média (ms) | p99 (ms) | Máximo (ms) | Meta SLA | Status |
| :--- | ---: | ---: | ---: | :---: | :---: |
| **.xlsx** | 13.7 | 28.73 | 28.73 | < 250 ms | PASSOU |
| **.csv** | 0.31 | 0.62 | 0.62 | < 250 ms | PASSOU |

## 2. Preenchimento Sequencial AJAX & Matching (45 alunos × 4 atividades + 2 divergentes)

- **Tempo de abertura do painel Shadow DOM:** 15.46 ms (Meta: < 100 ms)
- **Eventos `onblur` AJAX esperados:** 180
- **Eventos `onblur` AJAX recebidos pelo servidor mock:** 180
- **Taxa de perda de eventos AJAX:** 0% (Meta: 0%)
- **Tempo total do lote sequencial (com latência mock 25ms/req):** 6650.28 ms
- **Precisão de matching:** 45/45 exatos, 0 falsos positivos (Meta: 100% exatos, 0 falsos positivos)

## 3. Tamanho Final dos Pacotes

| Artefato | Tamanho (KB) | Meta SLA | Status |
| :--- | ---: | :---: | :---: |
| `dist/chrome/` (descompactado) | 568.8 KB | < 1536 KB | PASSOU |
| `dist/firefox/` (descompactado) | 569 KB | < 1536 KB | PASSOU |
| `dist/preenche-sigeduc-chrome.zip` | 183.1 KB | — | OK |
| `dist/preenche-sigeduc-firefox.zip` | 183.2 KB | — | OK |
