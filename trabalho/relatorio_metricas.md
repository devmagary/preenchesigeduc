# Relatório de Métricas e SLA — Preenche SIGEduc

Gerado em: 2026-11-26T12:31:09.549Z

## 1. Parse de Planilha (500 linhas × 10 colunas, 20 execuções)

| Formato | Média (ms) | p99 (ms) | Máximo (ms) | Meta SLA | Status |
| :--- | ---: | ---: | ---: | :---: | :---: |
| **.xlsx** | 13.7 | 29.82 | 29.82 | < 250 ms | PASSOU |
| **.csv** | 0.34 | 1.58 | 1.58 | < 250 ms | PASSOU |

## 2. Preenchimento Sequencial AJAX & Matching (45 alunos × 4 atividades + 2 divergentes)

- **Tempo de abertura do painel Shadow DOM:** 13.94 ms (Meta: < 100 ms)
- **Eventos `onblur` AJAX esperados:** 180
- **Eventos `onblur` AJAX recebidos pelo servidor mock:** 180
- **Taxa de perda de eventos AJAX:** 0% (Meta: 0%)
- **Tempo total do lote sequencial (com latência mock 25ms/req):** 5718.47 ms
- **Precisão de matching:** 45/45 exatos, 0 falsos positivos (Meta: 100% exatos, 0 falsos positivos)

## 3. Tamanho Final dos Pacotes

| Artefato | Tamanho (KB) | Meta SLA | Status |
| :--- | ---: | :---: | :---: |
| `dist/chrome/` (descompactado) | 585.9 KB | < 1536 KB | PASSOU |
| `dist/firefox/` (descompactado) | 586.1 KB | < 1536 KB | PASSOU |
| `dist/preenche-sigeduc-chrome.zip` | 187.9 KB | < 512 KB | PASSOU |
| `dist/preenche-sigeduc-firefox.zip` | 188 KB | < 512 KB | PASSOU |
| `dist/preenche-sigeduc-edge-mobile.crx` | 188.5 KB | < 512 KB | PASSOU |
