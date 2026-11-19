# Organograma interativo — Câmara Municipal de Goiânia

HTML, CSS e JavaScript puros (D3 incluído em `js/vendor`). Não precisa instalar nada: abra `index.html`.

## O que você quer mudar? Edite aqui

| Quero mudar… | Arquivo | Onde |
| --- | --- | --- |
| Unidades, hierarquia, dimensão (legislativa/administrativa), macrounidade | `js/dados-organograma.js` | seção 3 (ESTRUTURA) |
| Siglas | `js/dados-organograma.js` | seção 1 (SIGLAS): a chave é o nome exato da unidade |
| Cores dos cards | `css/organograma.css` | seção 5 (CORES DOS CARDS) |
| Paleta, fonte, cores da página | `css/organograma.css` | seção 1 (CORES E FONTES) |
| Brasão do cabeçalho | `assets/brasao-camara.png` | — |
| Textos do topo, botões e legenda | `index.html` | — |
| Largura dos cards, espaços, celular x desktop | `js/organograma-perfil.js` | `perfilCelular` e `perfilDesktop` |
| Comportamento (clique, teclado, animação) | `js/organograma-core.js` | seção 4 (AÇÕES) |

Cada arquivo começa com um comentário dizendo o que tem dentro e onde editar.

## Como adicionar ou mudar uma unidade

Em `js/dados-organograma.js`, cada `node(...)` é um card e a lista `filhos` define quem é subordinado.
Atalhos prontos: `diretoria(...)` (macrounidade), `commission(nome, sigla)` (legislativa), `chefia`, `assessoria`, `coordenadoria`, `gerencia`.
Para marcar uma unidade como legislativa, use `{ dimensao: 'legislativa' }` (já existe a constante `LEG`).
Se algo estiver errado nos dados, a página mostra um aviso com o motivo e não desenha nada.

## Interface

- Cada card mostra **sigla** (se houver), **nome** e uma **seta** que abre ou fecha as unidades subordinadas.
- Tema: contorno azul-marinho (`#242F62`) identifica Plenário, Mesa Diretora, comissões, vice-presidências e secretarias; contorno verde-escuro (`#1A5529`) identifica unidades administrativas, incluindo o Conselho de Ética e as Ouvidorias Especiais. Fundos azul e verde em tons pastel e texto preto mantêm os cartões leves e legíveis.
- Macrounidades — Gabinete da Presidência, Procuradoria Geral, Controladoria Geral e todas as diretorias — mantêm o fundo e o contorno da dimensão, com texto maior e faixa dourada escurecida (`#8F661C`). O topo usa verde (`#158028`), conectores usam grafite (`#34383F`) e os demais detalhes usam dourado.
- No modo incorporado em iframe, um contorno tracejado cinza-ardósia (`#737B8F`), afastado 8 px do diagrama, delimita sua área sem alterar a página independente.
- O fundo claro e o contraste dos textos mantêm a leitura confortável. A combinação de cores é verificada por `tests/cores_test.py`, incluindo contraste e simulações de daltonismo.
- Topo com identificação e "Voltar ao site"; barra com *Expandir próximo nível*, *Expandir tudo*, *Recolher tudo* e a legenda legislativa/administrativa.
- Teclado: setas navegam, Enter/Espaço abrem ou fecham, Home/End vão ao primeiro/último card.
- No celular (até 640 px) abrir um ramo da raiz fecha os outros.

## Estrutura dos arquivos

```text
index.html                  página do organograma
exemplo-no-site.html        simulação dentro de uma página do site (ver INCORPORACAO.md)
css/organograma.css         todos os estilos
js/dados-organograma.js     unidades e siglas  (principal arquivo de edição)
js/organograma-layout.js    cálculo das posições (sem DOM, testado em Node)
js/organograma-core.js      montagem, animação, teclado, acessibilidade
js/organograma-perfil.js    tamanhos por tela; inicia o organograma (carrega por último)
js/organograma-incorporado.js  modo dentro de <iframe>
js/vendor/d3.min.js         biblioteca D3 (não editar)
tests/                      testes automáticos
```

Ordem de carregamento: dados → layout → núcleo → perfil.

## Testes

```text
node tests/layout.test.js         posições (sem sobreposição, linhas sem atravessar cards)
python3 tests/cores_test.py       contraste e daltonismo das cores do CSS
python3 tests/browser_test.py     navegador real (precisa de playwright)
```

Depois de mudar cores, rode `cores_test.py`; depois de mudar dados, `layout.test.js`.

## Dentro do site

Ver `INCORPORACAO.md`.

## Fonte

O manual da CMG usa Calibri. Onde ela não existe, entra Carlito (mesmas medidas) ou a fonte do sistema.
