# Finance AI — Preferências do projeto

> Este arquivo é lido pelo Claude Code em toda sessão aberta neste diretório.
> Mantenha-o pequeno e apenas com regras gerais que se aplicam sempre.

## Regras de UI (obrigatórias)

### 1. Moeda — sempre pt-BR / BRL
- **TODO campo monetário deve aceitar e exibir no formato brasileiro** com separador de milhar `.` e decimal `,` (ex.: `1.234,56`).
- Ao exibir (labels, KPIs, tabelas): usar o helper `fmt(v)` que já formata como `R$ 1.234,56` (pt-BR, BRL).
- Em inputs de formulário (modais de edição, criação): usar `moneyInput(id, value)` (preencha com valor formatado BR) e `num($(#id).value)` para ler. Nunca usar `type="number"` em valor monetário — usar `type="text" inputmode="decimal"`.
- Quando pré-popular valores existentes num input de edição, formate com `fmtNum(v)` (igual ao `fmt` mas sem o prefixo `R$`) para que o usuário veja `1.234,56` em vez de `1234.56`.

### 2. Datas
- Formato brasileiro `dd/mm/aaaa` na UI; ISO `yyyy-mm-dd` no storage.

### 3. Locale
- `toLocaleString("pt-BR", ...)` em todas as conversões.

## Arquitetura
- Front-end: vanilla JS SPA (hash-routing) em `frontend/` — SEM build step.
- Persistência: `localStorage` (ver `storage.js`).
- Versão: bump em 3 lugares ao lançar (`sw.js` CACHE, `index.html` meta+`V`, `?v=XXX` nos scripts).
- Deploy: GitHub Pages em https://andersonassissouza.github.io/finance-ai/.
