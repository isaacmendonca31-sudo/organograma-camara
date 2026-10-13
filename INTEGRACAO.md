# Integração Projeto 01 → Projeto 02

O Projeto 02 (D3 + algoritmo de layout próprio + testes) foi mantido como base. Do Projeto 01 foram portados exatamente seis itens; o restante do 01 já existia no 02 (e melhor) ou era defeito que não foi carregado (redirecionar por User-Agent, re-render completo sem animação, estado perdido ao recarregar, layout sem medição, motor monolítico, ausência de testes).

## O que foi portado

| # | Recurso | Onde está |
|---|---|---|
| 1 | Busca com normalização de acentos (nome, sigla e tipo; 12 resultados; teclado; `aria-live`) | `js/organograma-busca.js` (novo); chamada em `organograma-core.js`; campo nos dois HTMLs; estilos em `css/organograma.css` (seção 4) |
| 2 | Validação da árvore antes de renderizar (`validarArvore`) | `js/organograma-core.js` (`validarArvore`, `mostrarErroDeDados`) |
| 3 | Botão "Expandir próximo nível" | `js/organograma-core.js` (`expandirProximoNivel`); botão `data-acao="expandir-nivel"` nos dois HTMLs |
| 4 | Legenda clicável (botões que levam ao primeiro nó do tipo) | `js/organograma-core.js` (bloco "Legenda"); estilos `.legenda-item` em `css/organograma.css` (seção 5) |
| 5 | Acordeão nas raízes, somente no mobile | flag `acordeaoRaizes: true` em `js/organograma-mobile.js`; lógica em `organograma-core.js` (`aplicarAcordeao`) |
| 6 | `index.html` redirecionador por `matchMedia` (sem User-Agent) | `index.html` (novo) |

## Arquivos

| Arquivo | Situação | Observação |
|---|---|---|
| `index.html` | novo | redireciona com `matchMedia('(max-width: 640px)')`; `<noscript>` com links |
| `organograma-desktop.html` / `organograma-mobile.html` | modificado | busca, botão novo, script da busca |
| `LEIAME.md` | atualizado | busca, botão, legenda, acordeão, validação |
| `INTEGRACAO.md` | novo | este arquivo |
| `css/organograma.css` | modificado | seções de busca e legenda; comentários |
| `css/desktop.css`, `css/mobile.css` | inalterado | idênticos byte a byte |
| `js/vendor/d3.min.js` | inalterado | D3 v7.9.0 |
| `js/dados-organograma.js` | inalterado | dados oficiais, idênticos byte a byte |
| `js/organograma-layout.js` | só comentários | código idêntico (ver abaixo) |
| `js/organograma-core.js` | modificado | recursos 2, 3, 4, 5 e chamada da busca; comentários |
| `js/organograma-busca.js` | novo | recurso 1 |
| `js/organograma-desktop.js` | só comentários | código idêntico (ver abaixo) |
| `js/organograma-mobile.js` | modificado | flag `acordeaoRaizes`; comentários |
| `tests/layout.test.js` | inalterado | idêntico byte a byte; continua passando |
| `tests/browser_test.py` | modificado | novos cenários; comentários |

## Decisões que não estavam explícitas

1. **Comentários em `organograma-layout.js` e `organograma-desktop.js`.** O pedido de documentar o código convive com a regra de não alterar esses arquivos. Foram acrescentados **somente comentários**; a árvore sintática (AST) do código foi comparada com a original e é idêntica, e `layout.test.js` segue passando. `dados-organograma.js`, `d3.min.js`, `desktop.css`, `mobile.css` e `layout.test.js` não foram tocados.
2. **"Primeiro nó do tipo"** (legenda) = primeiro na ordem de leitura do organograma (pré-ordem: pai antes dos filhos, irmãos na ordem dos dados).
3. **Mensagem de navegação.** O núcleo passou a anunciar "Navegando para X" (antes "Indo para X"), para coincidir com o texto pedido; a busca anuncia só a quantidade de resultados, evitando que dois anúncios se sobreponham.
4. **Acordeão e navegação direta.** A regra vale ao abrir um filho direto da raiz por clique/toque/teclado no card. Busca, legenda, atalhos, "Expandir tudo" e "Expandir próximo nível" a ignoram.
5. **Busca com vários termos** exige todos (E lógico) e ordena por relevância (sigla exata, começo da sigla, começo do nome, começo de palavra, contém); empates mantêm a ordem do organograma.
6. **Segundo `Esc`** no campo de busca limpa o texto (o primeiro só fecha a lista).
7. **Ponto de corte do redirecionador:** 640 px, o mesmo ponto em que o perfil desktop passa a usar medidas compactas.
8. **Legenda:** itens com altura mínima de 28 px no desktop e 32 px no mobile (em vez de 44 px, que tornaria a legenda muito alta no celular, com 12 itens).
9. **Verificação estática:** o ESLint não pôde ser instalado no ambiente (rede do npm indisponível); a checagem usou `node --check` e comparação de AST.
